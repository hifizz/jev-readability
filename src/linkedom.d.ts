/** The optional Node parser is not bundled into the browser entrypoint. */
declare module 'linkedom' {
  export function parseHTML(html: string): { document: Document };
}
