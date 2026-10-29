import ExpoModulesCore

/// The app's on-device intelligence: a look at a snapped photo before it goes to the cloud to be
/// priced, and Worthy's chat for the light questions. Prices always come from the cloud.
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

    // Worthy's chat, answered on the phone for the light questions (see WorthyChat).
    Function("worthyStatus") { () -> String in
      WorthyChat.status()
    }

    // A fresh conversation, with the model loaded before the first question.
    Function("startWorthyChat") {
      WorthyChat.start()
    }

    AsyncFunction("askWorthy") { (question: String) async -> WorthyAnswer? in
      await WorthyChat.ask(question)
    }
  }
}
