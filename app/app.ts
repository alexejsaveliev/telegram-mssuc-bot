import Telegraf, {ContextMessageUpdate, Context} from 'telegraf';
import axios from 'axios';
import { TELEGRAM_API_KEY }  from './utils/secrets';

const allowedServices = [
    {id: 'open.spotify.com', name: 'Spotify'},
    {id: 'music.apple.com', name: 'Apple Music'}
];

const apiKey = TELEGRAM_API_KEY || '';

const bot = new Telegraf(apiKey);
bot.start((ctx: ContextMessageUpdate) => ctx.reply('Welcome'));
bot.help((ctx: ContextMessageUpdate) => ctx.reply('Send me a sticker'));
bot.on('text', (ctx: Context) => {
    const message = ctx.update.message?.text || '';
    const messageIncludeLink = allowedServices.some(({ id }) => message.includes(id));

    if (messageIncludeLink) {
        console.log(message)
        getSpotifyDataByURL(message);
    }
});
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

bot.command('oldschool', (ctx) => ctx.reply('Hello'))
bot.command('modern', ({ reply }) => reply('Yo'))
bot.command('hipster', Telegraf.reply('λ'))

async function getSpotifyDataByURL(url: string) {
    // console.log(url)
    let baseUrl = 'https://itunes.apple.com/';
    let searchType = 'album'; 
    if (!url.includes('/album')) {
        return
    }

    if (url.includes('?i=')) { //song
        searchType = 'song';
    }

    let srtArr = url.match(/\w+$/g) || [];
    if (!srtArr.length) {
        return
    }
    const searchUrl = `${baseUrl}lookup?id=${srtArr[0]}&entity=${searchType}`;
    console.log(searchUrl)

    try {
        const res = await axios.get(searchUrl);
        console.log(res.data);
        console.log('next');
        const link = await getSpotifyLink();
        console.log(link)
    } catch (error) {
        console.log(error)
    }

}

async function getSpotifyLink() {
    try {
        const res = await axios({
            method: 'get',
            url: 'https://api.spotify.com/v1/search?q=Iss004&type=album',
            responseType: 'json',
            headers: { 'Authorization': 'Bearer BQAbxfiaTTrDEAiAGLdEQ767odXh-6zKVxIwr4o5rBh7THJwU0xCuEevsXZQaFFpVkdbObiL8aeizqHLdIu3q0OyY9LaljP1-BfXuIP2g05sd23TM-xJ5hW8tup0yvCoi56j4kDMQqU7-w',
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'}
          });
        return res.data;
    } catch (error) {
        throw error;
        
    }
}

bot.launch();