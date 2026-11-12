// Ambient declarations for editors without the Deno extension enabled.
// Deno itself uses its built-in runtime types and ignores this file unless imported.
declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
  };
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
  function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'jsr:@std/assert@1' {
  export function assertEquals<T>(actual: T, expected: T, msg?: string): void;
}
