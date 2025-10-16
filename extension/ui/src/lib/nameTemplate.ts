export const applyBotNameTemplate = (template: string, botName: string, currency: string): string => {
  return template
    .replace(/\{bot_name\}/gi, botName)
    .replace(/\{currency\}/gi, currency)
    .replace(/\{asset\}/gi, currency);
};
