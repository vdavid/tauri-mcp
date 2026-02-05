//! macOS screenshot implementation using `WKWebView.takeSnapshot`
//!
//! This module requires unsafe code to interact with Objective-C APIs via FFI.
//! The unsafe blocks are necessary for:
//! - Accessing the underlying `WKWebView` from Tauri's webview handle
//! - Calling `WKWebView.takeSnapshot` which uses Objective-C blocks
//! - Converting between `NSImage`/`NSData` and Rust types

#![allow(unsafe_code)]

use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use base64::Engine;
use block2::RcBlock;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
use objc2_foundation::{MainThreadMarker, NSDictionary, NSError, NSNumber, NSString};
use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};
use tauri::{Runtime, WebviewWindow};

/// Capture screenshot on macOS using native `WKWebView` API
pub fn capture<R: Runtime>(window: &WebviewWindow<R>, format: &str, quality: Option<u8>) -> Result<String, String> {
    // Check if window is visible
    if !window.is_visible().unwrap_or(false) {
        return Err("Window is not visible. Cannot capture screenshot of hidden window.".to_string());
    }

    if window.is_minimized().unwrap_or(false) {
        return Err("Window is minimized. Cannot capture screenshot of minimized window.".to_string());
    }

    // Create channel for async result
    let (tx, rx) = mpsc::channel::<Result<Vec<u8>, String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    // Use Tauri's with_webview to access the platform-specific webview
    window
        .with_webview(move |webview| {
            // Safety: We're accessing the underlying WKWebView through Tauri's webview handle.
            // This is safe because:
            // 1. Tauri guarantees the webview handle is valid when with_webview callback runs
            // 2. WKWebView is the actual type used by Tauri on macOS
            // 3. with_webview runs on the main thread on macOS
            unsafe {
                // Get main thread marker - we know we're on the main thread in with_webview
                let mtm = MainThreadMarker::new_unchecked();

                // Get the WKWebView from Tauri's webview handle
                let wkwebview: &WKWebView = &*(webview.inner().cast::<WKWebView>());

                // Create snapshot configuration (captures visible viewport)
                let config = WKSnapshotConfiguration::new(mtm);

                // Create completion handler block
                let handler = RcBlock::new(move |image: *mut NSImage, error: *mut NSError| {
                    // Extract the sender from the mutex, handling potential poisoning
                    let sender = {
                        let Ok(mut guard) = tx.lock() else {
                            return; // Mutex poisoned, can't do anything
                        };
                        guard.take()
                    };
                    let Some(tx) = sender else {
                        return; // Already sent
                    };
                    if !error.is_null() {
                        let err = &*error;
                        let desc = err.localizedDescription();
                        let error_string = desc.to_string();
                        let _ = tx.send(Err(format!("WKWebView snapshot failed: {error_string}")));
                    } else if !image.is_null() {
                        let img = &*image;
                        match convert_nsimage_to_png(img) {
                            Ok(data) => {
                                let _ = tx.send(Ok(data));
                            }
                            Err(e) => {
                                let _ = tx.send(Err(e));
                            }
                        }
                    } else {
                        let _ = tx.send(Err(
                            "WKWebView snapshot returned no image. The webview may be empty.".to_string()
                        ));
                    }
                });

                // Take snapshot
                wkwebview.takeSnapshotWithConfiguration_completionHandler(Some(&config), &handler);
            }
        })
        .map_err(|e| format!("Failed to access webview: {e}"))?;

    // Wait for result with timeout
    let png_data = match rx.recv_timeout(Duration::from_secs(10)) {
        Ok(result) => result?,
        Err(_) => return Err("Screenshot capture timed out after 10 seconds.".to_string()),
    };

    // Convert to requested format
    let final_data = if format == "jpeg" || format == "jpg" {
        convert_png_to_jpeg(&png_data, quality.unwrap_or(80))?
    } else {
        png_data
    };

    Ok(base64::engine::general_purpose::STANDARD.encode(final_data))
}

/// Convert `NSImage` to PNG bytes
///
/// Safety: The caller must ensure `image` is a valid `NSImage` pointer
unsafe fn convert_nsimage_to_png(image: &NSImage) -> Result<Vec<u8>, String> {
    // Get TIFF representation from NSImage
    let tiff_data = image
        .TIFFRepresentation()
        .ok_or_else(|| "Failed to get TIFF representation from NSImage.".to_string())?;

    // Create bitmap representation from TIFF data
    let bitmap = NSBitmapImageRep::imageRepWithData(&tiff_data)
        .ok_or_else(|| "Failed to create bitmap representation from image data.".to_string())?;

    // Convert to PNG with empty properties dictionary
    let properties = NSDictionary::new();
    let png_data = bitmap
        .representationUsingType_properties(NSBitmapImageFileType::PNG, &properties)
        .ok_or_else(|| "Failed to encode image as PNG.".to_string())?;

    // Convert NSData to Vec<u8> using the safe to_vec() method
    Ok(png_data.to_vec())
}

/// Convert PNG bytes to JPEG with specified quality
fn convert_png_to_jpeg(png_data: &[u8], quality: u8) -> Result<Vec<u8>, String> {
    // Load PNG data into NSData and create bitmap rep
    // Safety: We're creating NSData from valid PNG bytes and using safe AppKit encoding APIs
    unsafe {
        use objc2::runtime::AnyObject;

        let ns_data = objc2_foundation::NSData::with_bytes(png_data);
        let bitmap = NSBitmapImageRep::imageRepWithData(&ns_data)
            .ok_or_else(|| "Failed to decode PNG data for JPEG conversion.".to_string())?;

        // Create properties dictionary with compression factor
        // NSImageCompressionFactor expects a value between 0.0 and 1.0
        let compression_key = objc2_app_kit::NSImageCompressionFactor;
        let compression_value = NSNumber::new_f64(f64::from(quality) / 100.0);

        // Create the dictionary using dictionaryWithObject_forKey
        // Cast the NSNumber to AnyObject and use the NSString key directly (implements NSCopying)
        let value_as_any: &AnyObject = compression_value.as_ref();
        let key_as_copying = objc2::runtime::ProtocolObject::from_ref(compression_key);
        let properties = NSDictionary::<NSString, AnyObject>::dictionaryWithObject_forKey(value_as_any, key_as_copying);

        let jpeg_data = bitmap
            .representationUsingType_properties(NSBitmapImageFileType::JPEG, &properties)
            .ok_or_else(|| "Failed to encode image as JPEG.".to_string())?;

        // Convert NSData to Vec<u8> using the safe to_vec() method
        Ok(jpeg_data.to_vec())
    }
}
