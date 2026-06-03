require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// --- CONFIGURATION ---
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

client.once('ready', () => {
    console.log(`✅ Bot connecté : ${client.user.tag}`);
});

// --- COMMANDE SETUP ---
client.on('messageCreate', async message => {
    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        for (const lang in CONFIG) {
            const config = CONFIG[lang];
            const embed = new EmbedBuilder()
                .setTitle(config.title)
                .setDescription("Cliquez sur le bouton ci-dessous pour ouvrir un ticket.")
                .setColor(0x0099FF);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_${lang}`)
                    .setLabel(config.label)
                    .setStyle(ButtonStyle.Primary)
            );

            for (const chanId of config.channels) {
                try {
                    const channel = await client.channels.fetch(chanId);
                    await channel.send({ embeds: [embed], components: [row] });
                    console.log(`Panel ${lang} envoyé dans ${chanId}`);
                } catch (err) {
                    console.error(`Erreur sur le canal ${chanId}:`, err);
                }
            }
        }
    }
});

// --- GESTION DES TICKETS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('ticket_')) return;

    const lang = interaction.customId.split('_')[1];
    const guild = interaction.guild;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentId,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ]
        });

        await interaction.editReply({ content: `✅ Ticket créé : ${ticketChannel}` });
        ticketChannel.send(`Bonjour ${user}, un membre du staff vous répondra dès que possible.`);

        const logChan = await guild.channels.fetch(CONFIG[lang].logChannel);
        logChan.send(`🎫 **Nouveau ticket**\nCréateur: ${user.tag}\nSalon: ${ticketChannel}`);
    } catch (err) {
        interaction.editReply({ content: "❌ Une erreur est survenue lors de la création du ticket." });
    }
});

client.login(process.env.TOKEN);
