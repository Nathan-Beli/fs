require('dotenv').config();
const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, 
    MessageFlags, AttachmentBuilder, REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Serveur HTTP pour maintenir le bot éveillé (ex: Render, Koyeb)
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

// Map pour stocker les timers de suppression automatique de 24h
const activeCloseRequests = new Map();

// Configuration des IDs des Rôles
const ROLES = { 
    staff: '1511885579975921816',
    ca: '1512224304534655157',        // Designer
    bilingue: '1512224349246197880',  // Designer bilingue
    extra: '1512228013457018910',
    verification: '1532365439928107038' // Rôle requis obligatoire pour ouvrir un ticket
};

// ID du salon vocal pour le compteur de membres
const VOICE_CHANNEL_ID = '1532388090008572066'; 

// Configuration des Salons, Textes et Bannière
const CONFIG = {
    orderChannels: [
        '1511527048932491384', 
        '1511527053864730667', 
        '1511527057967022240', 
        '1511527062375235634'
    ],
    supportChannel: '1511527043697741836',
    logChannel: '1511527076996583458',
    defaultTitle: "Support Design Studio",
    desc: "Cliquez ci-dessous pour ouvrir un ticket.",
    label: "Ouvrir un ticket",
    // Liste numérotée avec émojis 1, 2, 3, 4
    rules: ":one: Un ticket par commande.\n:two: Pas de spam.\n:three: Respectez le staff.\n:four: Donnez vos infos immédiatement.",
    
    // Titres personnalisés par ID de salon
    customTitles: {
        '1511527048932491384': "Commande Design Studio"
    },

    bannerUrl: process.env.BANNER_URL || ""
};

/**
 * Fonction utilitaire pour attacher la bannière (locale ou distante) à un Embed
 */
function attachBanner(embed) {
    const localBannerPath = path.join(__dirname, 'banniere.png');
    const files = [];

    if (fs.existsSync(localBannerPath)) {
        const banner = new AttachmentBuilder(localBannerPath, { name: 'banniere.png' });
        embed.setImage('attachment://banniere.png');
        files.push(banner);
    } else if (CONFIG.bannerUrl && CONFIG.bannerUrl.startsWith('http')) {
        embed.setImage(CONFIG.bannerUrl);
    }

    return files;
}

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

// Enregistrement des commandes Slash (Commandes /)
const commands = [
    new SlashCommandBuilder()
        .setName('closerequest')
        .setDescription('Demande la fermeture du ticket sous 24h sans réponse.')
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('Raison de la demande de fermeture')
                .setRequired(false)
        )
].map(command => command.toJSON());

// Événement : Lancement du bot
client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    // Enregistrement de la commande /closerequest
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🔄 Enregistrement des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Commandes Slash enregistrées avec succès.');
    } catch (error) {
        console.error('❌ Erreur lors de l’enregistrement des commandes Slash :', error);
    }

    await updateMemberCountVoice();
    setInterval(updateMemberCountVoice, 10 * 60 * 1000); // Mise à jour toutes les 10 minutes
});

// Événement : Gestion des Interactions (Boutons + Commandes Slash)
client.on('interactionCreate', async interaction => {
    
    // --- GESTION DE LA COMMANDE SLASH /closerequest ---
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'closerequest') {

            // Vérification si la commande est exécutée dans un ticket
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({
                    content: "❌ Cette commande peut uniquement être utilisée dans un ticket !",
                    flags: MessageFlags.Ephemeral
                });
            }

            // Vérifier s'il y a déjà un délai actif sur ce ticket
            if (activeCloseRequests.has(interaction.channel.id)) {
                return interaction.reply({
                    content: "⚠️ Une demande de fermeture est déjà en cours pour ce ticket.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const raison = interaction.options.getString('raison') || "Aucune raison fournie.";

            // Récupérer le nom de l'utilisateur à partir du nom du salon (ex: ticket-pseudo)
            const usernameFromChannel = interaction.channel.name.replace('ticket-', '');
            const ticketOwner = interaction.guild.members.cache.find(m => m.user.username.toLowerCase() === usernameFromChannel);

            const embedCloseReq = new EmbedBuilder()
                .setTitle("⚠️ Demande de fermeture du ticket")
                .setDescription(`Un membre du staff a demandé la fermeture de ce ticket.\n\n**Raison :** ${raison}\n\n🕒 **Sans réponse ou action de votre part, ce ticket sera automatiquement supprimé dans 24 heures.**`)
                .setColor(0xe74c3c)
                .setTimestamp();

            // Boutons : Fermer le ticket OU Garder ouvert
            const closeReqRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('keep_ticket_open')
                    .setLabel('Garder le ticket ouvert')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket maintenant')
                    .setStyle(ButtonStyle.Danger)
            );

            // Mention du créateur du ticket dans le contenu du message
            const mentionText = ticketOwner ? `<@${ticketOwner.id}>` : "";

            await interaction.reply({ 
                content: mentionText ? `🔔 ${mentionText}` : null,
                embeds: [embedCloseReq], 
                components: [closeReqRow] 
            });

            // Planification de la suppression automatique après 24 heures (86 400 000 ms)
            const timeoutId = setTimeout(async () => {
                try {
                    const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
                    if (channel) {
                        await channel.send("⏳ **Délai de 24h écoulé sans réponse.** Suppression du ticket...");
                        setTimeout(() => channel.delete().catch(console.error), 3000);
                    }
                } catch (err) {
                    console.error("Erreur lors de la suppression automatique du ticket :", err);
                } finally {
                    activeCloseRequests.delete(interaction.channelId);
                }
            }, 24 * 60 * 60 * 1000);

            // Stockage de l'identifiant du timer
            activeCloseRequests.set(interaction.channel.id, timeoutId);
            return;
        }
    }

    // --- GESTION DES BOUTONS ---
    if (!interaction.isButton()) return;

    // Bouton : Garder le ticket ouvert
    if (interaction.customId === 'keep_ticket_open') {
        if (activeCloseRequests.has(interaction.channel.id)) {
            clearTimeout(activeCloseRequests.get(interaction.channel.id));
            activeCloseRequests.delete(interaction.channel.id);

            await interaction.reply({
                content: `✅ <@${interaction.user.id}> a annulé la demande de fermeture. Le ticket reste ouvert !`
            });

            // Désactiver les boutons sur le message de la demande de fermeture
            if (interaction.message) {
                await interaction.message.edit({ components: [] }).catch(() => null);
            }
        } else {
            await interaction.reply({
                content: "⚠️ Aucune demande de fermeture active à annuler.",
                flags: MessageFlags.Ephemeral
            });
        }
    }

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
        const targetRoleIds = [ROLES.staff, ROLES.bilingue, ROLES.extra, ROLES.ca];
        const validRoles = targetRoleIds.filter(roleId => interaction.guild.roles.cache.has(roleId));

        // 4. Récupération de la catégorie parente
        const categoryId = interaction.channel.parentId;

        try {
            // Création du salon textuel
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

            // Préparation de l'embed du règlement
            const embed = new EmbedBuilder()
                .setTitle("🎫 Règlement du Ticket")
                .setDescription(CONFIG.rules)
                .setColor(0xb79a5e);

            // Application de la bannière
            const bannerFiles = attachBanner(embed);

            // Bouton de fermeture du ticket
            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            const sendPayload = {
                content: `<@${interaction.user.id}> <@&${ROLES.staff}> <@&${ROLES.extra}>`,
                embeds: [embed],
                components: [closeRow],
                files: bannerFiles
            };

            // Envoi du message d'accueil dans le salon du ticket
            await channel.send(sendPayload);
             
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
        // Annuler le timer de 24h s'il existait
        if (activeCloseRequests.has(interaction.channel.id)) {
            clearTimeout(activeCloseRequests.get(interaction.channel.id));
            activeCloseRequests.delete(interaction.channel.id);
        }

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

        const targets = isSetup ? CONFIG.orderChannels : [CONFIG.supportChannel];

        for (const id of targets) {
            const chan = await client.channels.fetch(id).catch(() => null);
            if (chan) {
                // Définition du titre spécifique selon le salon
                const panelTitle = CONFIG.customTitles[id] || CONFIG.defaultTitle;

                const embedPanel = new EmbedBuilder()
                    .setTitle(panelTitle)
                    .setDescription(CONFIG.desc)
                    .setColor(0xb79a5e);

                const bannerFiles = attachBanner(embedPanel);

                await chan.send({ embeds: [embedPanel], components: [row], files: bannerFiles });
            }
        }

        message.reply(`✅ Panneau(x) envoyé(s) avec succès.`);
    }
});

// Connexion du bot avec le Token
client.login(process.env.TOKEN);
