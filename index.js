require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const CONFIG = {
    FR: {
        channels: ['1511527048932491384', '1511527053864730667', '1511527057967022240', '1511527062375235634'],
        logChannel: '1511527076996583458',
        rules: ":ticket:┃**Règlement des Tickets — Federal Studio**\n\n:pushpin: Afin de garder un support organisé, merci de respecter les règles suivantes :\n\n:one: **Un ticket par commande**\n:x: Ne fermez pas votre ticket pour en ouvrir un autre.\n:two: **Pas de spam** (Pings abusifs interdits).\n:three: **Respect** des designers.\n:four: **Informations claires** (Véhicule, style, texte, référence).\n:five: **Patience**.\n:six: **Fermeture** si commande terminée ou réglée.",
        label: "Ouvrir un ticket",
        logMsg: "Nouveau ticket créé par"
    },
    EN: {
        channels: ['1511532622956986500', '1511532626039799901', '1511532630158610715', '1511532635082592267'],
        logChannel: '1511532647078297830',
        rules: ":ticket:┃**Ticket Rules — Federal Studio**\n\n:pushpin: To keep support organized, please respect the following rules:\n\n:one: **One ticket per order**\n:x: Do not close your ticket to open another.\n:two: **No spamming** (Excessive pings prohibited).\n:three: **Respect** designers and staff.\n:four: **Clear info** (Vehicle, style, text, reference).\n:five: **Patience**.\n:six: **Closing** if order completed or resolved.",
        label: "Open a ticket",
        logMsg: "New ticket created by"
    }
};

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const [action, lang] = interaction.customId.split('_');

        // OUVERTURE
        if (action === 'open') {
            const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existing) return interaction.reply({ content: "Vous avez déjà un ticket ouvert.", ephemeral: true });

            await interaction.deferReply({ ephemeral: true });
            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: interaction.channel.parentId,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }]
            });

            const closeRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer / Close').setStyle(ButtonStyle.Danger));
            await channel.send({ content: CONFIG[lang].rules, components: [closeRow] });
            
            const logChan = await interaction.guild.channels.fetch(CONFIG[lang].logChannel);
            logChan.send(`${CONFIG[lang].logMsg} ${interaction.user.tag} : ${channel}`);
            await interaction.editReply({ content: `Ticket créé : ${channel}` });
        }

        // FERMETURE
        if (action === 'close') {
            await interaction.reply("Le ticket sera supprimé dans 5 secondes...");
            setTimeout(() => interaction.channel.delete(), 5000);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.content === '!setup' && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        for (const lang in CONFIG) {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_${lang}`).setLabel(CONFIG[lang].label).setStyle(ButtonStyle.Primary));
            for (const id of CONFIG[lang].channels) {
                const chan = await client.channels.fetch(id);
                await chan.send({ embeds: [new EmbedBuilder().setTitle("Support Federal Studio").setDescription("Cliquez ci-dessous pour ouvrir un ticket.")], components: [row] });
            }
        }
    }
});

client.login(process.env.TOKEN);
