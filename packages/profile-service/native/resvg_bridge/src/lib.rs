use image::{codecs::jpeg::JpegEncoder, ExtendedColorType};
use resvg::{tiny_skia, usvg};
use std::{mem, slice};

const FORMAT_PNG: u32 = 1;
const FORMAT_JPEG: u32 = 2;

fn encode_jpeg(pixmap: tiny_skia::Pixmap) -> Result<Vec<u8>, image::ImageError> {
    let mut rgb = Vec::with_capacity((pixmap.width() * pixmap.height() * 3) as usize);

    for pixel in pixmap.pixels() {
        let rgba = pixel.demultiply();
        rgb.push(rgba.red());
        rgb.push(rgba.green());
        rgb.push(rgba.blue());
    }

    let mut bytes = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut bytes, 90);
    encoder.encode(&rgb, pixmap.width(), pixmap.height(), ExtendedColorType::Rgb8)?;
    Ok(bytes)
}

#[no_mangle]
pub extern "C" fn render_svg(
    svg_ptr: *const u8,
    svg_len: usize,
    width: u32,
    height: u32,
    format: u32,
    out_ptr: *mut *mut u8,
    out_len: *mut usize,
) -> u32 {
    if svg_ptr.is_null() || out_ptr.is_null() || out_len.is_null() {
        return 1;
    }

    let svg = unsafe { slice::from_raw_parts(svg_ptr, svg_len) };
    let options = usvg::Options::default();
    let tree = match usvg::Tree::from_data(svg, &options) {
        Ok(tree) => tree,
        Err(_) => return 2,
    };

    let source_size = tree.size().to_int_size();
    let target_width = if width == 0 { source_size.width() } else { width };
    let target_height = if height == 0 { source_size.height() } else { height };

    let mut pixmap = match tiny_skia::Pixmap::new(target_width, target_height) {
        Some(pixmap) => pixmap,
        None => return 3,
    };

    let transform = tiny_skia::Transform::from_scale(
        target_width as f32 / source_size.width() as f32,
        target_height as f32 / source_size.height() as f32,
    );

    resvg::render(&tree, transform, &mut pixmap.as_mut());

    let encoded = match format {
        FORMAT_PNG => match pixmap.encode_png() {
            Ok(bytes) => bytes,
            Err(_) => return 4,
        },
        FORMAT_JPEG => match encode_jpeg(pixmap) {
            Ok(bytes) => bytes,
            Err(_) => return 5,
        },
        _ => return 6,
    };

    let mut output = encoded;
    let output_len = output.len();
    let output_ptr = output.as_mut_ptr();
    mem::forget(output);

    unsafe {
        *out_ptr = output_ptr;
        *out_len = output_len;
    }

    0
}

#[no_mangle]
pub extern "C" fn free_buffer(buffer_ptr: *mut u8, buffer_len: usize) {
    if buffer_ptr.is_null() || buffer_len == 0 {
        return;
    }

    unsafe {
        drop(Vec::from_raw_parts(buffer_ptr, buffer_len, buffer_len));
    }
}
