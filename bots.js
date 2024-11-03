// Bot classes
class MockingBot {
     process(message) {
          return message;
     }
}
class UltiKhopdi {
     process(message) {
          return message.split('').reverse().join('');
     }
}

class CatBot {
     process(message) {
          const msg = message.split(' ');
          let text = 'Meow';
          for (let i = 0; i < msg.length - 1; i++) {
               text += " meow";
          };
          return text;
     }
}

class BinoBot {
     process(message) {
          return message.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
     }
}

// Export the botManager
export const botManager = {
     getBotResponse(botName, message) {
          // Input validation
          if (!message || typeof message !== 'string') {
               return 'Invalid input';
          }

          let bot;
          try {
               switch (botName) {
                    case 'Mockingbird':
                         bot = new MockingBot();
                         break;
                    case 'Cat':
                         bot = new CatBot();
                         break;
                    case 'Bino':
                         bot = new BinoBot();
                         break;
                    case "Ulti Khopdi":
                         bot = new UltiKhopdi();
                         break;
                    default:
                         return message;
               }
               return bot.process(message);
          } catch (error) {
               console.error('Bot processing error:', error);
               return 'Sorry, I encountered an error processing your message';
          }
     },

     getResponseDelay() {
          return Math.floor(Math.random() * 1000) + 500;
     }
};
