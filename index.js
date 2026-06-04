require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const http = require('http');

// Serveur pour garder le bot actif sur Render
http.createServer((req, res) => res.end('Bot Online')).listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const CONFIG = {
    FR: {
        channels: ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'],
        supportChannel: '1511527043697741836',
        logChannel: '1511527076996583458',
        rules: ":one: Un ticket par commande.\n:two: Pas de spam.\n:three: Respectez le staff.\n:four: Donnez vos infos (Véhicule, style, texte, réf) immédiatement.",
        label: "Ouvrir un ticket",
        logMsg: "Nouveau ticket créé par"
    },
    EN: {
        channels: ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'],
        supportChannel: '1511532619307946097',
        logChannel: '1511532647078297830',
        rules: ":one: One ticket per order.\n:two: No spamming.\n:three: Respect the staff.\n:four: Provide clear info (Vehicle, style, text, ref) immediately.",
        label: "Open a ticket",
        logMsg: "New ticket created by"
    }
};

const ROLES = { designer: '1511885388002758778', staff: '1511885579975921816' };

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const [action, lang] = interaction.customId.split('_');

    if (action === 'open') {
        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existing) return interaction.reply({ content: "❌ Ticket déjà ouvert.", ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ROLES.designer, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ROLES.staff, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const embedRules = new EmbedBuilder()
            .setTitle(lang === 'FR' ? "🎫 Règlement du Ticket" : "🎫 Ticket Rules")
            .setDescription(CONFIG[lang].rules)
            .setColor(0x0099FF);

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer / Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@${interaction.user.id}> <@&${ROLES.designer}> <@&${ROLES.staff}>`, embeds: [embedRules], components: [closeRow] });
        
        const logChan = await interaction.guild.channels.fetch(CONFIG[lang].logChannel);
        logChan.send(`${CONFIG[lang].logMsg} ${interaction.user} : ${channel}`);
        await interaction.editReply({ content: `✅ Ticket : ${channel}` });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply("Suppression dans 5 secondes...");
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
});

client.on('messageCreate', async message => {
    if (message.content === '!setup' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        for (const lang in CONFIG) {
            // Panel Ticket
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`open_${lang}`).setLabel(CONFIG[lang].label).setStyle(ButtonStyle.Primary)
            );
            for (const id of CONFIG[lang].channels) {
                const chan = await client.channels.fetch(id);
                await chan.send({ embeds: [new EmbedBuilder().setTitle("Support").setDescription("Cliquez pour ouvrir un ticket")], components: [row] });
            }
            // Embed Support info
            const supChan = await client.channels.fetch(CONFIG[lang].supportChannel);
            await supChan.send({ embeds: [new EmbedBuilder().setTitle("Support Info").setDescription("Besoin d'aide ? Nos designers et staff sont là pour vous.")] });
        }
    }
});

client.login(process.env.TOKEN);
