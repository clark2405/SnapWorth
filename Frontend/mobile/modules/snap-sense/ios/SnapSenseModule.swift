import ExpoModulesCore

/// The phone's own look at a snapped photo, before it goes to the cloud to be priced. Pricing
/// stays in the cloud: these only say whether the photo is worth sending, and what's in it.
public class SnapSenseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SnapSense")

    // Any iPhone: brightness, sharpness, the main subject, and any text or barcode in the photo.
    AsyncFunction("measurePhoto") { (uri: URL) throws -> PhotoMeasurement in
      try PhotoMeasure.measure(uri)
    }

    // Apple Intelligence on iOS 27: why the item reader can't run, or "available".
    Function("itemReaderStatus") { () -> String in
      ItemReader.status()
    }

    // Loads the on-device model while the camera is open, so the first read is quick.
    Function("prepareItemReader") {
      ItemReader.prepare()
    }

    AsyncFunction("readItem") { (uri: URL) async -> ItemImpression? in
      await ItemReader.read(uri)
    }
  }
}
