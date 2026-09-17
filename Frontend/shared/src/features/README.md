# Shared Features

Feature modules own route-neutral views, form state, discriminated async state, optimistic state, and orchestration. Web route wrappers render these views without importing services or infrastructure directly.

Feature providers call injected service interfaces, preserve recoverable photo and draft input across failures, and expose complete loading, empty, offline, failed, and success states. Nothing below this layer knows that browser routes exist.
