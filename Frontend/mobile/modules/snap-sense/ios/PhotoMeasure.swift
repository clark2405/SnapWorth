import CoreGraphics
import ExpoModulesCore
import ImageIO
import Vision

struct PhotoMeasurement: Record {
  /// Mean brightness, 0 (black) to 1 (white).
  @Field var brightness: Double = 0
  /// Spread of the edges at 512px across (variance of a Laplacian). Blur flattens it.
  @Field var sharpness: Double = 0
  /// Share of the frame the main subject fills, or nil when Vision finds none.
  @Field var subject: Double? = nil
  /// Whether Vision could look for a subject at all. Its neural requests need the Neural
  /// Engine, which the simulator doesn't have; without it, no subject means nothing.
  @Field var looked: Bool = false
  /// Lines of text read in the photo: brand labels, size tags, model numbers.
  @Field var text: [String] = []
  /// Barcode and QR payloads.
  @Field var codes: [String] = []
}

final class PhotoUnreadableException: Exception, @unchecked Sendable {
  override var reason: String { "This photo could not be read." }
}

enum PhotoMeasure {
  static func measure(_ url: URL) throws -> PhotoMeasurement {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = thumbnail(source, maxPixels: 1600)
    else { throw PhotoUnreadableException() }

    var result = PhotoMeasurement()
    let (brightness, sharpness) = pixelStats(image)
    result.brightness = brightness
    result.sharpness = sharpness

    let text = VNRecognizeTextRequest()
    text.recognitionLevel = .accurate
    let codes = VNDetectBarcodesRequest()
    let subject = VNGenerateObjectnessBasedSaliencyImageRequest()
    // The thumbnail is already turned upright, so Vision reads it as it is. Each request runs
    // on its own, so one that can't run here leaves the others' answers.
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
    try? handler.perform([text])
    try? handler.perform([codes])
    result.looked = (try? handler.perform([subject])) != nil

    result.text = (text.results ?? [])
      .compactMap { $0.topCandidates(1).first }
      .filter { $0.confidence >= 0.5 }
      .map { $0.string.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .prefix(12)
      .map { String($0.prefix(80)) }
    result.codes = Array(
      Set((codes.results ?? []).compactMap { $0.payloadStringValue }).prefix(4)
    ).map { String($0.prefix(64)) }
    let areas = (subject.results?.first?.salientObjects ?? []).map {
      Double($0.boundingBox.width * $0.boundingBox.height)
    }
    result.subject = areas.max()
    return result
  }

  /// The photo turned upright, at most `maxPixels` on its long side.
  static func thumbnail(_ source: CGImageSource, maxPixels: Int) -> CGImage? {
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixels,
    ]
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  }

  /// Brightness and sharpness from a 512px grey copy, so the numbers compare across cameras.
  static func pixelStats(_ image: CGImage) -> (Double, Double) {
    let scale = 512 / Double(max(image.width, image.height))
    let width = max(3, Int(Double(image.width) * min(1, scale)))
    let height = max(3, Int(Double(image.height) * min(1, scale)))
    var pixels = [UInt8](repeating: 0, count: width * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard
        let context = CGContext(
          data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
          bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(),
          bitmapInfo: CGImageAlphaInfo.none.rawValue)
      else { return false }
      context.interpolationQuality = .medium
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { return (0, 0) }

    var total = 0.0
    for value in pixels { total += Double(value) }
    var sum = 0.0
    var squares = 0.0
    var count = 0.0
    for y in 1..<(height - 1) {
      for x in 1..<(width - 1) {
        let i = y * width + x
        let edge =
          Double(pixels[i - 1]) + Double(pixels[i + 1]) + Double(pixels[i - width])
          + Double(pixels[i + width]) - 4 * Double(pixels[i])
        sum += edge
        squares += edge * edge
        count += 1
      }
    }
    let mean = sum / count
    return (total / Double(pixels.count) / 255, squares / count - mean * mean)
  }
}
