require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const channelsFR = ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'];
const channelsEN = ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'];

const messageFR = `:ticket:┃**Règlement des Tickets — Federal Studio**\n\n:pushpin: Afin de garder un support organisé, merci de respecter les règles suivantes :\n\n:one: **Un ticket par commande**\nMerci de garder le même ticket pour toute votre commande.\n:x: Ne fermez pas votre ticket pour en ouvrir un autre pour la même demande.\n\n:two: **Pas de spam**\nÉvitez d’envoyer plusieurs messages inutiles. Les pings abusifs des designers ou du staff sont interdits.\n\n:three: **Respect**\nRespectez les designers et les membres du staff. Tout manque de respect peut entraîner la fermeture du ticket.\n\n:four: **Informations claires**\nQuand vous ouvrez un ticket, essayez de donner directement :\n:red_car: le véhicule | :art: le style | :pencil: le texte | :camera: une référence\n\n:five: **Patience**\nLes designers peuvent prendre du temps pour répondre. Merci de ne pas demander constamment si votre commande est prête.\n\n:six: **Fermeture de ticket**\nUn ticket peut être fermé si la commande est terminée, réglée ou sans réponse.`;

const messageEN = `:ticket:┃**Ticket Rules — Federal Studio**\n\n:pushpin: To keep support organized, please respect the following rules:\n\n:one: **One ticket per order**\nPlease keep the same ticket for your entire order.\n:x: Do not close your ticket to open another one for the same request.\n\n:two: **No spamming**\nAvoid sending multiple unnecessary messages. Excessive pinging of designers or staff is prohibited.\n\n:three: **Respect**\nRespect the designers and staff members. Any lack of respect may lead to the ticket being closed.\n\n:four: **Clear information**\nWhen opening a ticket, try to provide the following immediately:\n:red_car: the vehicle | :art: the style | :pencil: the text | :camera: a reference\n\n:five: **Patience**\nDesigners may take some time to respond. Please do not constantly ask if your order is ready.\n\n:six: **Closing a ticket**\nA ticket may be closed if the order is completed, resolved or after no response.`;

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    const processChannels = async (channelIds, content) => {
        for (const id of channelIds) {
            const channel = await client.channels.fetch(id);
            if (!channel) continue;

            // Vérifie si le bot a déjà posté dans les 10 derniers messages
            const messages = await channel.messages.fetch({ limit: 10 });
            const alreadyExists = messages.some(msg => msg.author.id === client.user.id && msg.content.includes(':ticket:'));

            if (!alreadyExists) {
                await channel.send(content);
                console.log(`Message envoyé dans ${id}`);
            } else {
                console.log(`Message déjà présent dans ${id}`);
            }
        }
    };

    await processChannels(channelsFR, messageFR);
    await processChannels(channelsEN, messageEN);
});

client.login(process.env.TOKEN);
