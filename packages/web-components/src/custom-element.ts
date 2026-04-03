export const defineElement = <TConstructor extends CustomElementConstructor>(
  tagName: string,
  constructor: TConstructor,
): void => {
  if (typeof customElements === "undefined" || customElements.get(tagName)) {
    return;
  }
  customElements.define(tagName, constructor);
};
