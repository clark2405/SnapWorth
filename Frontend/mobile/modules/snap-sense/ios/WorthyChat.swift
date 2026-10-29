import ExpoModulesCore

#if canImport(FoundationModels)
  import FoundationModels
#endif

/// One turn of Worthy's chat, answered on the phone: what the person is asking for, and Worthy's
/// own words when it's something the small model can answer (how the app works, how to photograph
/// or describe an item, wording a message). Prices, trends and listings are routed to the app's
/// data instead, so the model never states a value.
struct WorthyAnswer: Record {
  @Field var intent: String = "chat"
  @Field var reply: String = ""
}

#if canImport(FoundationModels)
  @available(iOS 26.0, *)
  @Generable
  struct WorthyTurn {
    @Guide(
      description: """
        What the person wants. price: what an item is worth, whether a price is fair, or what to \
        offer. trend: which items or categories are rising. collection: the total value of their \
        own items, or which of them to sell. listing: asking Worthy to write the listing text for \
        their item. chat: anything else, including how to sell, how to photograph or describe an \
        item, how the app works, and wording a message.
        """,
      .anyOf(["chat", "price", "trend", "collection", "listing"]))
    var intent: String
    @Guide(
      description:
        "Worthy's answer in one to three short sentences, only when the intent is chat; otherwise empty"
    )
    var reply: String
  }

  @available(iOS 26.0, *)
  private actor Conversation {
    static let shared = Conversation()
    private var session: LanguageModelSession?

    private static let instructions = """
      You are Worthy, the friendly price-tag mascot of SnapWorth, an app for secondhand items in \
      the Philippines. How the app works:
      - Snap: photograph an item to get a rough AI price estimate in pesos. It's a guide, not a \
      sale price.
      - From an estimate, choose Sell to list the item in the Market at a price you set, or post \
      it to the Feed so the community votes on the price.
      - The community votes a price Priced right, Too high or a Steal.
      - History keeps the items you've snapped. Chats is for messaging buyers and sellers.
      - Anyone can look around. Snapping, voting and selling need a free account, so every price \
      and vote comes from a real person and the verdicts stay fair.
      - Good photos: bright, even light, the whole item in frame, plus close-ups of labels, size \
      tags and any wear.

      Answer warmly and briefly, in plain words. Help with how the app works, how to photograph or \
      describe an item, and how to word a message to a buyer or seller. Never state a price, a \
      value or an amount of money, and never guess one: when someone asks what something is \
      worth, the intent is price. Don't invent features, sales or numbers. If you don't know, say \
      so and suggest snapping the item.
      """

    private func fresh() -> LanguageModelSession {
      LanguageModelSession(model: SystemLanguageModel.default, instructions: Self.instructions)
    }

    func reset() {
      session = nil
    }

    func prepare() {
      if session == nil {
        let next = fresh()
        next.prewarm()
        session = next
      }
    }

    func ask(_ question: String) async -> WorthyAnswer? {
      let current = session ?? fresh()
      session = current
      if let answer = await respond(current, question) { return answer }
      // A long chat can outgrow the model's context, or one answer can be refused: start the
      // conversation over once rather than leave Worthy stuck.
      let restarted = fresh()
      session = restarted
      return await respond(restarted, question)
    }

    private func respond(_ session: LanguageModelSession, _ question: String) async
      -> WorthyAnswer?
    {
      do {
        let turn = try await session.respond(to: question, generating: WorthyTurn.self).content
        var answer = WorthyAnswer()
        answer.intent = turn.intent
        answer.reply = String(turn.reply.prefix(600))
        return answer
      } catch {
        return nil
      }
    }
  }
#endif

enum WorthyChat {
  /// The chat needs only text, which the on-device model has had since iOS 26.
  static func status() -> String {
    #if canImport(FoundationModels)
      guard #available(iOS 26.0, *) else { return "unsupportedOS" }
      switch SystemLanguageModel.default.availability {
      case .available:
        return "available"
      case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible: return "deviceNotEligible"
        case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
        case .modelNotReady: return "modelNotReady"
        @unknown default: return "unavailable"
        }
      }
    #else
      return "unsupportedOS"
    #endif
  }

  static func start() {
    #if canImport(FoundationModels)
      guard #available(iOS 26.0, *), status() == "available" else { return }
      Task {
        await Conversation.shared.reset()
        await Conversation.shared.prepare()
      }
    #endif
  }

  static func ask(_ question: String) async -> WorthyAnswer? {
    #if canImport(FoundationModels)
      guard #available(iOS 26.0, *), status() == "available" else { return nil }
      return await Conversation.shared.ask(String(question.prefix(500)))
    #else
      return nil
    #endif
  }
}
