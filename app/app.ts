import Telegraf, { ContextMessageUpdate, Context } from 'telegraf';
import axios from 'axios';

import logger from './utils/logger'
import { TELEGRAM_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN, SPOTIFY_SECRET } from './utils/secrets';
import { log, error } from 'winston';
import winston = require('winston/lib/winston/config');

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
        let res = '';
        try {
            res = await getSpotifyURL(message);
        } catch (error) {
            res = error.message;
        }
       
        if (res) {
            ctx.replyWithHTML(res);
        }
    }
});


async function getSpotifyURL(url: string) {
    console.log(url)
    let baseUrl = 'https://itunes.apple.com/';
    let searchType = 'album';
    if (!url.includes('/album')) {
        return ''
    }

    if (url.includes('?i=')) { //song
        searchType = 'song';
    }

    let srtArr = url.match(/\w+$/g) || []; //id
    if (!srtArr.length) {
        return ''
    }
    const searchUrl = `${baseUrl}lookup?id=${srtArr[0]}&entity=${searchType}`;
    console.log(searchUrl)

    try {
        const res = await axios.get(searchUrl);
        console.log(res.data);
        if (res.data?.resultCount) {
            const {artistName, trackName = '', collectionName} = res.data.results[0];
            const queryString = cleanString(`${ artistName } ${ collectionName } ${ trackName } `);

            const spotifyData = await getSpotifyData(searchType === 'song' ? 'track' : searchType, queryString);

            const searchCollection = searchType === 'song' ? spotifyData.tracks : spotifyData.albums;
            
            if (searchCollection?.total) {
                return searchCollection.items[0].external_urls.spotify;
            } else {
                const errorMsg = `Cant find spotify data for query: <b>${ queryString }</b>`;
                logger.warn(errorMsg);
                throw new Error(errorMsg);
            }
        } else {
            const errorMsg = 'Cant find iTunes data. URL: ' + searchUrl;
            logger.warn(errorMsg);
            throw new Error('Cant find iTunes data 😢');
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
        //   console.log(res.data.tracks.items)
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
    const words = [
        ' - EP',
        '[Deluxe Version]'
    ];

    let newStr = str;
    words.forEach(el => newStr = str.replace(el, ''))
    return str;
}

bot.launch();