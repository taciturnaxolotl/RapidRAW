// SPDX-License-Identifier: LGPL-2.1
// Copyright 2021 Daniel Vogelbacher <daniel@chaospixel.com>

use crate::{
  cfa::{PlaneColor, CFA},
  imgop::{sensor::bayer::RgbBayerPattern, Dim2, Rect},
  pixarray::{Color2D, PixF32},
};
use rayon::prelude::*;

use super::Demosaic;

#[derive(Default)]
pub struct Superpixel3Channel {}

impl Superpixel3Channel {
  pub fn new() -> Self {
    Self {}
  }
}

impl Demosaic<f32, 3> for Superpixel3Channel {
  /// Debayer image by using superpixel method.
  /// Each output pixel RGB tuple is generated by 4 pixels from input.
  /// The result image is 1/4 of size (half width, half height).
  fn demosaic(&self, pixels: &PixF32, cfa: &CFA, colors: &PlaneColor, roi: Rect) -> Color2D<f32, 3> {
    if colors.plane_count() != 3 {
      panic!("Demosaic for 3 channels needs 3 color planes, but {} given", colors.plane_count());
    }
    if !cfa.is_rgb() {
      panic!("Demosaic for 3 channels requires RGB CFA pattern, but CFA {} given", cfa);
    }
    // ROI width / height must be align on bayer pattern size, so deleting the rightmost bit will do the job.
    let roi = Rect::new(roi.p, Dim2::new(roi.width() & !1, roi.height() & !1));
    let dim = pixels.dim();
    log::debug!("Superpixel debayer ROI: {:?}", roi);

    let cfa = cfa.shift(roi.p.x, roi.p.y);
    let pattern = match cfa.name.as_str() {
      "RGGB" => RgbBayerPattern::RGGB,
      "BGGR" => RgbBayerPattern::BGGR,
      "GBRG" => RgbBayerPattern::GBRG,
      "GRBG" => RgbBayerPattern::GRBG,
      _ => unreachable!(), // Guarded by is_rgb()
    };

    // Truncate ROI outer lines
    let window = &pixels[roi.y() * dim.w..roi.y() * dim.w + roi.height() * dim.w];

    let out = window
      .par_chunks_exact(dim.w * 2)
      .map(|s| {
        let (r1, r2) = s.split_at(dim.w);
        // Truncate ROI outer columns
        let (r1, r2) = (&r1[roi.x()..roi.x() + roi.width()], &r2[roi.x()..roi.x() + roi.width()]);
        r1.chunks_exact(2)
          .zip(r2.chunks_exact(2))
          .map(|(a, b)| {
            let p = [a[0], a[1], b[0], b[1]];
            match pattern {
              RgbBayerPattern::RGGB => [p[0], (p[1] + p[2]) / 2.0, p[3]],
              RgbBayerPattern::BGGR => [p[3], (p[1] + p[2]) / 2.0, p[0]],
              RgbBayerPattern::GBRG => [p[2], (p[0] + p[3]) / 2.0, p[1]],
              RgbBayerPattern::GRBG => [p[1], (p[0] + p[3]) / 2.0, p[2]],
            }
          })
          .collect::<Vec<_>>()
      })
      .flatten()
      .collect();
    Color2D::new_with(out, roi.d.w >> 1, roi.d.h >> 1)
  }
}

#[derive(Default)]
pub struct Superpixel4Channel {}

impl Superpixel4Channel {
  pub fn new() -> Self {
    Self {}
  }
}

impl Demosaic<f32, 4> for Superpixel4Channel {
  /// Debayer image by using superpixel method.
  /// Each output pixel RGB tuple is generated by 4 pixels from input.
  /// The result image is 1/4 of size.
  fn demosaic(&self, pixels: &PixF32, cfa: &CFA, colors: &PlaneColor, roi: Rect) -> Color2D<f32, 4> {
    if colors.plane_count() != 4 {
      panic!("Demosaic for 4 channels needs 4 color planes, but {} given", colors.plane_count());
    }
    // ROI width / height must be align on bayer pattern size, so deleting the rightmost bit will do the job.
    let roi = Rect::new(roi.p, Dim2::new(roi.width() & !1, roi.height() & !1));

    log::debug!("Superpixel debayer ROI: {:?}", roi);

    let cfa = cfa.shift(roi.p.x, roi.p.y);
    let dim = pixels.dim();
    // Index into colormap is plane number, value is the index into 2x2 Bayer superpixel.
    let colormap: [usize; 4] = colors.plane_colors::<4>().map(|c| PlaneColor::cfa_index(&cfa, c));

    // Truncate ROI outer lines
    let window = &pixels[roi.y() * dim.w..roi.y() * dim.w + roi.height() * dim.w];

    let out = window
      .par_chunks_exact(dim.w * 2)
      .map(|s| {
        let (r1, r2) = s.split_at(dim.w);
        // Truncate ROI outer columns
        let (r1, r2) = (&r1[roi.x()..roi.x() + roi.width()], &r2[roi.x()..roi.x() + roi.width()]);
        r1.chunks_exact(2)
          .zip(r2.chunks_exact(2))
          .map(|(a, b)| {
            let superpixel = [a[0], a[1], b[0], b[1]];
            // Map superpixel into correct ordering (CFAPlaneColor)
            [
              superpixel[colormap[0]],
              superpixel[colormap[1]],
              superpixel[colormap[2]],
              superpixel[colormap[3]],
            ]
          })
          .collect::<Vec<_>>()
      })
      .flatten()
      .collect();

    Color2D::new_with(out, roi.d.w >> 1, roi.d.h >> 1)
  }
}

/// This is the new implementation for the "Speed" demosaicing option.
#[derive(Default)]
pub struct SuperpixelQuarterRes3Channel {}

impl SuperpixelQuarterRes3Channel {
  pub fn new() -> Self {
    Self {}
  }
}

impl Demosaic<f32, 3> for SuperpixelQuarterRes3Channel {
  /// Debayer image by using a 4x4 superpixel method.
  /// Each output pixel RGB tuple is generated by 16 pixels from input.
  /// The result image is 1/16 of size (1/4 width, 1/4 height).
  fn demosaic(&self, pixels: &PixF32, cfa: &CFA, colors: &PlaneColor, roi: Rect) -> Color2D<f32, 3> {
    if !cfa.is_rgb() {
      panic!("Demosaic for 3 channels requires RGB CFA pattern, but CFA {} given", cfa);
    }
    if colors.plane_count() != 3 {
      panic!("Demosaic for 3 channels needs 3 color planes, but {} given", colors.plane_count());
    }

    // ROI width / height must be a multiple of 4.
    let roi = Rect::new(roi.p, Dim2::new(roi.width() & !3, roi.height() & !3));
    let dim = pixels.dim();
    log::debug!("Superpixel Quarter-Res debayer ROI: {:?}", roi);

    let cfa = cfa.shift(roi.p.x, roi.p.y);

    // Get a slice of the image corresponding to the ROI.
    let window = &pixels[roi.y() * dim.w..];

    let out_data: Vec<[f32; 3]> = window
      .par_chunks_exact(dim.w * 4) // Process 4 rows at a time
      .take(roi.height() / 4) // Process roi.height() rows in total
      .flat_map(|four_rows_slice| {
        // four_rows_slice has length dim.w * 4
        // It contains 4 full rows of the original image.
        // We need to get the ROI part of these rows.
        let row0 = &four_rows_slice[roi.x()..roi.x() + roi.width()];
        let row1 = &four_rows_slice[dim.w + roi.x()..dim.w + roi.x() + roi.width()];
        let row2 = &four_rows_slice[dim.w * 2 + roi.x()..dim.w * 2 + roi.x() + roi.width()];
        let row3 = &four_rows_slice[dim.w * 3 + roi.x()..dim.w * 3 + roi.x() + roi.width()];

        // Now we have the 4 rows for the ROI. We need to process them in 4-pixel chunks.
        row0
          .chunks_exact(4)
          .zip(row1.chunks_exact(4))
          .zip(row2.chunks_exact(4))
          .zip(row3.chunks_exact(4))
          .map(|(((p0, p1), p2), p3)| {
            // p0, p1, p2, p3 are slices of 4 pixels each.
            // They form a 4x4 block.
            let mut sums = [0.0f32; 3];
            let mut counts = [0; 3];

            let block = [p0, p1, p2, p3];

            for y_offset in 0..4 {
              for x_offset in 0..4 {
                // Use relative offset for cfa pattern lookup
                let color_index = cfa.color_at(y_offset, x_offset);
                let pixel_value = block[y_offset][x_offset];
                sums[color_index] += pixel_value;
                counts[color_index] += 1;
              }
            }

            let r = if counts[0] > 0 { sums[0] / counts[0] as f32 } else { 0.0 };
            let g = if counts[1] > 0 { sums[1] / counts[1] as f32 } else { 0.0 };
            let b = if counts[2] > 0 { sums[2] / counts[2] as f32 } else { 0.0 };

            [r, g, b]
          })
          .collect::<Vec<_>>()
      })
      .collect();

    Color2D::new_with(out_data, roi.width() >> 2, roi.height() >> 2)
  }
}