require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, 
    MessageFlags 
} = require('discord.js');
const http = require('http');

// 1. Serveur HTTP pour Render + Boucle Anti-Veille
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('Bot Online')).listen(PORT);

setInterval(() => {
    http.get(`https://fs-mzcd.onrender.com`, (res) => {
        console.log(`Ping auto : ${res.statusCode}`);
    }).on('error', (e) => console.error(`Erreur de ping : ${e.message}`));
}, 5 * 60 * 1000); 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// Configuration des Rôles
const ROLES = { 
    staff: '1511885579975921816',
    fr: '1512224304534655157',
    en: '1511885388002758778',
    bilingue: '1512224349246197880'
};

const CONFIG = {
    FR: {
        orderChannels: ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'],
        supportChannel: '1511527043697741836',
        logChannel: '1511527076996583458',
        title: "Support Federal Studio",
        desc: "Cliquez ci-dessous pour ouvrir un ticket.",
        label: "Ouvrir un ticket",
        logMsg: "Nouveau ticket créé par",
        rules: ":one: Un ticket par commande.\n:two: Pas de spam.\n:three: Respectez le staff.\n:four: Donnez vos infos immédiatement."
    },
    EN: {
        orderChannels: ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'],
        supportChannel: '1511532619307946097',
        logChannel: '1511532647078297830',
        title: "Federal Studio Support",
        desc: "Click below to open a ticket.",
        label: "Open a ticket",
        logMsg: "New ticket created by",
        rules: ":one: One ticket per order.\n:two: No spamming.\n:three: Respect the staff.\n:four: Provide clear info immediately."
    }
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const [action, lang] = interaction.customId.split('_');

    if (action === 'open') {
        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existing) return interaction.reply({ content: lang === 'FR' ? "❌ Ticket déjà ouvert." : "❌ Ticket already open.", flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Logique dynamique des rôles
        const rolesToAllow = [ROLES.staff, ROLES.bilingue];
        rolesToAllow.push(lang === 'FR' ? ROLES.fr : ROLES.en);

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ...rolesToAllow.map(roleId => ({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                }))
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(lang === 'FR' ? "🎫 Règlement du Ticket" : "🎫 Ticket Rules")
            .setDescription(CONFIG[lang].rules)
            .setColor(0x0099FF);

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer / Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@${interaction.user.id}> <@&${ROLES.staff}>`, embeds: [embed], components: [closeRow] });
        
        const logChan = await interaction.guild.channels.fetch(CONFIG[lang].logChannel);
        if (logChan) logChan.send(`${CONFIG[lang].logMsg} ${interaction.user} : ${channel}`);
        
        await interaction.editReply({ content: `✅ Ticket : ${channel}` });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: "Suppression du ticket dans 5 secondes...", flags: MessageFlags.Ephemeral });
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
});

client.on('messageCreate', async message => {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (message.content === '!setup' || message.content === '!support') {
        const isSetup = message.content === '!setup';
        for (const lang in CONFIG) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`open_${lang}`).setLabel(CONFIG[lang].label).setStyle(ButtonStyle.Primary)
            );
            
            const targets = isSetup ? CONFIG[lang].orderChannels : [CONFIG[lang].supportChannel];
            for (const id of targets) {
                try {
                    const chan = await client.channels.fetch(id);
                    await chan.send({ 
                        embeds: [new EmbedBuilder().setTitle(CONFIG[lang].title).setDescription(CONFIG[lang].desc).setColor(0x0099FF)], 
                        components: [row] 
                    });
                } catch (err) { console.error(`Erreur sur le salon ${id}:`, err); }
            }
        }
        message.reply(`✅ Panneaux ${isSetup ? 'Setup' : 'Support'} envoyés.`);
    }
});

client.login(process.env.TOKEN);
