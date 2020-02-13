import Telegraf, { ContextMessageUpdate, Context } from 'telegraf';
import axios from 'axios';
import querystring from 'querystring';

import logger from './utils/logger'
import { TELEGRAM_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN, SPOTIFY_SECRET } from './utils/secrets';

const allowedServices = [
    { id: 'open.spotify.com', name: 'Spotify' },
    { id: 'music.apple.com', name: 'Apple Music' }
];

const apiKey = TELEGRAM_API_KEY || '';

const bot = new Telegraf(apiKey);
bot.start((ctx: ContextMessageUpdate) => ctx.reply('Welcome'));
bot.help((ctx: ContextMessageUpdate) => ctx.reply('Send me a sticker'));
bot.on('text', async (ctx: ContextMessageUpdate) => {
    const message = ctx.update.message?.text || '';
    const messageIncludeLink = allowedServices.some(({ id }) => message.includes(id));

    if (messageIncludeLink) {
        console.log(message)
        const newLink = await getSpotifyURL(message);
        if (newLink) {
            ctx.reply(newLink);
        }
    }
});


async function getSpotifyURL(url: string) {
    // console.log(url)
    let baseUrl = 'https://itunes.apple.com/';
    let searchType = 'album';
    if (!url.includes('/album')) {
        return ''
    }

    if (url.includes('?i=')) { //song
        searchType = 'song';
    }

    let srtArr = url.match(/\w+$/g) || [];
    if (!srtArr.length) {
        return ''
    }
    const searchUrl = `${baseUrl}lookup?id=${srtArr[0]}&entity=${searchType}`;
    console.log(searchUrl)

    try {
        const res = await axios.get(searchUrl);
        console.log(res.data);
        if (res.data?.resultCount) {
            const {artistName, collectionType, collectionName} = res.data.results[0];
            const spotifyData = await getSpotifyData(searchType, cleanString(artistName + ' ' + collectionName));
            
            if (spotifyData.albums?.total) {
                return spotifyData.albums.items[0].external_urls.spotify;
            }
        }
    } catch (error) {
        throw error;
    }

}

async function getSpotifyData(type: string, queryString: string) {

    try {
        const accessToken = await getSpotifyAccessToken();

        const res = await axios({
            method: 'get',
            url: `https://api.spotify.com/v1/search?q=${encodeURI(queryString)}&type=${type}`,
            responseType: 'json',
            headers: { 'Authorization': 'Bearer ' + accessToken,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'}
          });
        return res.data;
    } catch (error) {
        throw error;
    }
}

async function getSpotifyAccessToken() {
    try {
        const res = await axios({
            url: 'https://accounts.spotify.com/api/token',
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_SECRET).toString('base64')),
            },
            responseType: 'json',
            params: {
                grant_type: 'refresh_token',
                refresh_token: SPOTIFY_REFRESH_TOKEN
            }
        })

        if (res.status === 200) {
            return res.data.access_token;
        }
    } catch (error) {
        logger.error("Error while getting access token.");
    }
}

function cleanString(str:string) {
    return str.replace(' - EP', '');
}

bot.launch();