require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, 
    MessageFlags 
} = require('discord.js');
const http = require('http');

// Serveur HTTP pour maintenir le bot éveillé (ex: Render, Replit, Koyeb)
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

// Configuration des IDs des Rôles
const ROLES = { 
    staff: '1511885579975921816',
    fr: '1512224304534655157',        // Designer français
    en: '1511885388002758778',        // Designer anglais
    bilingue: '1512224349246197880',  // Designer bilingue
    extra: '1512228013457018910',
    verification: '1532365439928107038' // Rôle requis obligatoire pour ouvrir un ticket
};

// ID du salon vocal pour le compteur de membres
const VOICE_CHANNEL_ID = '1532388090008572066'; 

// Configuration des Salons et Textes
const CONFIG = {
    orderChannels: [
        '1511527048932491384', 
        '1511527053864730667', 
        '1511527057967022240', 
        '1511527062375235634'
    ],
    supportChannel: '1511527043697741836',
    logChannel: '1511527076996583458',
    title: "Support Design Studio",
    desc: "Cliquez ci-dessous pour ouvrir un ticket.",
    label: "Ouvrir un ticket",
    rules: ":one: Un ticket par commande.\n:two: Pas de spam.\n:three: Respectez le staff.\n:four: Donnez vos infos immédiatement."
};

// Fonction de mise à jour du salon vocal (Comptage des humains uniquement)
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

// Événement : Lancement du bot
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    await updateMemberCountVoice();
    setInterval(updateMemberCountVoice, 10 * 60 * 1000); // Mise à jour toutes les 10 minutes
});

// Événement : Gestion des Boutons
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Bouton d'ouverture de ticket
    if (interaction.customId === 'open_ticket') {
        
        // 1. Vérification du rôle requis
        if (!interaction.member.roles.cache.has(ROLES.verification)) {
            return interaction.reply({ 
                content: "❌ Il faut se vérifier pour pouvoir ouvrir un ticket !", 
                flags: MessageFlags.Ephemeral 
            });
        }

        // 2. Vérification si un ticket existe déjà
        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existing) {
            return interaction.reply({ 
                content: "❌ Vous avez déjà un ticket ouvert.", 
                flags: MessageFlags.Ephemeral 
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 3. Filtrage des rôles valides existants sur le serveur
        const targetRoleIds = [ROLES.staff, ROLES.bilingue, ROLES.extra, ROLES.fr];
        const validRoles = targetRoleIds.filter(roleId => interaction.guild.roles.cache.has(roleId));

        // 4. Récupération de la catégorie parente du salon où se trouve le panneau
        const categoryId = interaction.channel.parentId;

        try {
            // Création du salon textuel dans la même catégorie
            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId || null,
                permissionOverwrites: [
                    { 
                        id: interaction.guild.id, 
                        deny: [PermissionsBitField.Flags.ViewChannel] 
                    },
                    { 
                        id: interaction.user.id, 
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] 
                    },
                    ...validRoles.map(roleId => ({ 
                        id: roleId, 
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] 
                    }))
                ]
            });

            // Embed du règlement dans le ticket
            const embed = new EmbedBuilder()
                .setTitle("🎫 Règlement du Ticket")
                .setDescription(CONFIG.rules)
                .setColor(0xb79a5e);

            // Bouton de fermeture du ticket
            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            // Envoi du message d'accueil et des mentions dans le ticket
            await channel.send({ 
                content: `<@${interaction.user.id}> <@&${ROLES.staff}> <@&${ROLES.extra}>`, 
                embeds: [embed], 
                components: [closeRow] 
            });
             
            // Envoi du log d'ouverture
            const logEmbed = new EmbedBuilder()
                .setTitle("🎫 Ticket ouvert")
                .setColor(0xb79a5e)
                .addFields(
                    { name: "Membre", value: `${interaction.user} (${interaction.user.tag})`, inline: false },
                    { name: "Type", value: "Support Client", inline: false },
                    { name: "Salon", value: `${channel}`, inline: false }
                )
                .setFooter({ text: "Design Studio • Agence de design" })
                .setTimestamp();

            const logChan = await interaction.guild.channels.fetch(CONFIG.logChannel).catch(() => null);
            if (logChan) logChan.send({ embeds: [logEmbed] });
             
            await interaction.editReply({ content: `✅ Ticket créé avec succès : ${channel}` });

        } catch (error) {
            console.error("❌ ERREUR LORS DE LA CRÉATION DU TICKET :", error);
            await interaction.editReply({ 
                content: `❌ Impossible de créer le ticket : ${error.message}` 
            });
        }
    }

    // Bouton de fermeture de ticket
    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ 
            content: "🔒 Suppression du ticket dans 5 secondes...", 
            flags: MessageFlags.Ephemeral 
        });
        setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
    }
});

// Événement : Commandes Administrateur (!setup et !support)
client.on('messageCreate', async message => {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (message.content === '!setup' || message.content === '!support') {
        const isSetup = message.content === '!setup';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel(CONFIG.label)
                .setStyle(ButtonStyle.Primary)
        );

        const embedPanel = new EmbedBuilder()
            .setTitle(CONFIG.title)
            .setDescription(CONFIG.desc)
            .setColor(0xb79a5e);

        const targets = isSetup ? CONFIG.orderChannels : [CONFIG.supportChannel];

        for (const id of targets) {
            const chan = await client.channels.fetch(id).catch(() => null);
            if (chan) {
                await chan.send({ embeds: [embedPanel], components: [row] });
            }
        }

        message.reply(`✅ Panneau(x) envoyé(s) avec succès.`);
    }
});

// Connexion du bot avec le Token
client.login(process.env.TOKEN);
