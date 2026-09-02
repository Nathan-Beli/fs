require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, 
    MessageFlags 
} = require('discord.js');
const http = require('http');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Online');
}).listen(PORT, () => console.log(`Serveur de maintien actif sur le port ${PORT}`));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

const ROLES = { 
    staff: '1511885579975921816',
    fr: '1512224304534655157',
    en: '1511885388002758778',
    bilingue: '1512224349246197880',
    extra: '1512228013457018910',
    verification: '1532365439928107038' // Rôle requis obligatoire pour ouvrir un ticket
};

const VOICE_CHANNEL_ID = '1532388090008572066'; // Salon vocal du compteur de membres

const CONFIG = {
    FR: {
        orderChannels: ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'],
        supportChannel: '1511527043697741836',
        logChannel: '1511527076996583458',
        title: "Support Design Studio",
        desc: "Cliquez ci-dessous pour ouvrir un ticket.",
        label: "Ouvrir un ticket",
        rules: ":one: Un ticket par commande.\n:two: Pas de spam.\n:three: Respectez le staff.\n:four: Donnez vos infos immédiatement."
    },
    EN: {
        orderChannels: ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'],
        supportChannel: '1511532619307946097',
        logChannel: '1511532647078297830',
        title: "Design Studio Support",
        desc: "Click below to open a ticket.",
        label: "Open a ticket",
        rules: ":one: One ticket per order.\n:two: No spamming.\n:three: Respect the staff.\n:four: Provide clear info immediately."
    }
};

// Fonction pour mettre à jour le salon vocal (Membres sans les bots)
async function updateMemberCountVoice() {
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            await guild.members.fetch();
            const humanCount = guild.members.cache.filter(member => !member.user.bot).size;
            const voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
            
            if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
                await voiceChannel.setName(`Membres : ${humanCount}`);
            }
        } catch (error) {
            console.error(`Erreur lors de la mise à jour du salon vocal :`, error);
        }
    }
}

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    await updateMemberCountVoice();
    setInterval(updateMemberCountVoice, 10 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const [action, lang] = interaction.customId.split('_');

    if (action === 'open') {
        // Vérifie si le membre possède le rôle requis obligatoirement
        if (!interaction.member.roles.cache.has(ROLES.verification)) {
            return interaction.reply({ 
                content: lang === 'FR' ? "❌ Il faut se vérifier pour pouvoir ouvrir un ticket !" : "❌ You need to verify yourself to open a ticket!", 
                flags: MessageFlags.Ephemeral 
            });
        }

        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existing) return interaction.reply({ content: lang === 'FR' ? "❌ Ticket déjà ouvert." : "❌ Ticket already open.", flags: MessageFlags.Ephemeral });

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const rolesToAllow = [ROLES.staff, ROLES.bilingue, ROLES.extra, (lang === 'FR' ? ROLES.fr : ROLES.en)];

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: interaction.channel.parentId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ...rolesToAllow.map(roleId => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }))
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(lang === 'FR' ? "🎫 Règlement du Ticket" : "🎫 Ticket Rules")
            .setDescription(CONFIG[lang].rules)
            .setColor(0xb79a5e);

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer / Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
            content: `<@${interaction.user.id}> <@&${ROLES.staff}> <@&${ROLES.extra}>`, 
            embeds: [embed], 
            components: [closeRow] 
        });
         
        const logEmbed = new EmbedBuilder()
            .setTitle(lang === 'FR' ? "🎫 Ticket ouvert" : "🎫 Ticket Opened")
            .setColor(0xb79a5e)
            .addFields(
                { name: lang === 'FR' ? "Membre" : "Member", value: `${interaction.user} (${interaction.user.tag})`, inline: false },
                { name: "Type", value: lang === 'FR' ? "Support Client (FR)" : "Customer Support (EN)", inline: false },
                { name: lang === 'FR' ? "Salon" : "Channel", value: `${channel}`, inline: false }
            )
            .setFooter({ text: "Design Studio • Agence de design professionnelle" })
            .setTimestamp();

        const logChan = await interaction.guild.channels.fetch(CONFIG[lang].logChannel).catch(() => null);
        if (logChan) logChan.send({ embeds: [logEmbed] });
         
        await interaction.editReply({ content: `✅ Ticket créé : ${channel}` });
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
                const chan = await client.channels.fetch(id).catch(() => null);
                if (chan) await chan.send({ embeds: [new EmbedBuilder().setTitle(CONFIG[lang].title).setDescription(CONFIG[lang].desc).setColor(0xb79a5e)], components: [row] });
            }
        }
        message.reply(`✅ Panneaux envoyés.`);
    }
});

client.login(process.env.TOKEN);
