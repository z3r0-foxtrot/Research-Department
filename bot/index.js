require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const required = ['DISCORD_TOKEN', 'GUILD_ID', 'GUARD_CHANNEL_ID', 'APPROVER_ROLE_IDS'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw Error(`Missing ${missing.join(', ')}. Copy bot/.env.example to bot/.env and complete it.`);

const blue = 0x45baff;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const commands = [
  new SlashCommandBuilder()
    .setName('request-test').setDescription('Request an authorized research test')
    .addStringOption(o => o.setName('scp').setDescription('SCP designation').setRequired(true))
    .addStringOption(o => o.setName('summary').setDescription('Test objective and procedure').setRequired(true)),
  new SlashCommandBuilder()
    .setName('submit-test-result').setDescription('Submit a test result for ranked approval')
    .addStringOption(o => o.setName('scp').setDescription('SCP designation').setRequired(true))
    .addStringOption(o => o.setName('result').setDescription('Complete test result').setRequired(true)),
  new SlashCommandBuilder()
    .setName('request-guard').setDescription('Request a guard assignment')
    .addStringOption(o => o.setName('location').setDescription('Location or assignment').setRequired(true))
    .addStringOption(o => o.setName('details').setDescription('Required staffing and context').setRequired(true))
].map(command => command.toJSON());

function requestEmbed(title, requester, fields) {
  return new EmbedBuilder().setColor(blue).setTitle(title)
    .addFields({ name: 'Requested by', value: requester, inline: true }, ...fields)
    .setFooter({ text: 'Research Department · operational request' }).setTimestamp();
}

async function sendToApprovers(guild, embed) {
  const roleIds = process.env.APPROVER_ROLE_IDS.split(',').map(id => id.trim()).filter(Boolean);
  const members = await guild.members.fetch();
  const recipients = [...members.values()].filter(member => !member.user.bot && roleIds.some(roleId => member.roles.cache.has(roleId)));
  let delivered = 0;
  for (const member of recipients) {
    try { await member.send({ embeds: [embed] }); delivered += 1; } catch { /* DMs may be disabled. */ }
  }
  return { delivered, eligible: recipients.length };
}

async function fetchTextChannel(id) {
  const channel = await client.channels.fetch(id);
  if (!channel?.isTextBased()) throw Error('The configured channel is unavailable or is not a text channel.');
  return channel;
}

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.commands.set(commands);
    console.log(`Online as ${client.user.tag}. Slash commands registered in ${guild.name}.`);
  } catch (error) {
    console.error('Could not register slash commands:', error.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;
  await interaction.deferReply({ ephemeral: true });
  try {
    const scp = interaction.options.getString('scp');
    if (interaction.commandName === 'request-test') {
      const embed = requestEmbed('Research test requested', interaction.user.tag, [
        { name: 'SCP', value: scp, inline: true }, { name: 'Objective / procedure', value: interaction.options.getString('summary') }
      ]);
      if (process.env.TEST_REQUEST_CHANNEL_ID) await (await fetchTextChannel(process.env.TEST_REQUEST_CHANNEL_ID)).send({ embeds: [embed] });
      await interaction.editReply('Your test request has been logged for department review.');
    }
    if (interaction.commandName === 'submit-test-result') {
      const embed = requestEmbed('Test-result approval requested', interaction.user.tag, [
        { name: 'SCP', value: scp, inline: true }, { name: 'Result submitted for approval', value: interaction.options.getString('result') }
      ]);
      const result = await sendToApprovers(interaction.guild, embed);
      await interaction.editReply(`Result sent to ${result.delivered} of ${result.eligible} eligible approver(s).`);
    }
    if (interaction.commandName === 'request-guard') {
      const embed = requestEmbed('Guard assignment requested', interaction.user.tag, [
        { name: 'Location / assignment', value: interaction.options.getString('location'), inline: true }, { name: 'Details', value: interaction.options.getString('details') }
      ]);
      await (await fetchTextChannel(process.env.GUARD_CHANNEL_ID)).send({ embeds: [embed] });
      await interaction.editReply('Your guard request has been dispatched to the guard channel.');
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply(`Request could not be completed: ${error.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
