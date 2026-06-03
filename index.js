require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField 
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Configuration
const CONFIG = {
    FR: {
        channels: ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'],
        logChannel: '1511527076996583458',
        label: "Ouvrir un ticket",
        title: "🎫 Support Federal Studio"
    },
    EN: {
        channels: ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'],
        logChannel: '1511532647078297830',
        label: "Open a ticket",
        title: "🎫 Federal Studio Support"
    }
};

client.once('ready', async () => {
    console.log(`Bot prêt : ${client.user.tag}`);
});

// Écoute des interactions (clics sur les boutons)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('ticket_')) return;

    const lang = interaction.customId.split('_')[1]; // FR ou EN
    const guild = interaction.guild;
    const category = interaction.channel.parentId;

    // Création du canal
    const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
    });

    await interaction.reply({ content: `Ticket créé : ${ticketChannel}`, ephemeral: true });
    
    // Message dans le nouveau ticket
    ticketChannel.send(`Bienvenue ${interaction.user}, un membre du staff va arriver sous peu.`);
    
    // Log
    const logChan = guild.channels.cache.get(CONFIG[lang].logChannel);
    if (logChan) logChan.send(`Nouveau ticket créé par ${interaction.user.tag} dans ${ticketChannel.name}`);
});

// Commande pour envoyer les panels (ex: !setup)
client.on('messageCreate', async message => {
    if (message.content === '!setup') {
        Object.keys(CONFIG).forEach(lang => {
            const embed = new EmbedBuilder()
                .setTitle(CONFIG[lang].title)
                .setDescription("Cliquez sur le bouton ci-dessous pour ouvrir un ticket.")
                .setColor(0x0099FF);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_${lang}`)
                    .setLabel(CONFIG[lang].label)
                    .setStyle(ButtonStyle.Primary)
            );

            CONFIG[lang].channels.forEach(async chanId => {
                const channel = message.guild.channels.cache.get(chanId);
                if (channel) await channel.send({ embeds: [embed], components: [row] });
            });
        });
    }
});

client.login(process.env.TOKEN);
