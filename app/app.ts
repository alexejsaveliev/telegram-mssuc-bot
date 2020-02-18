import Telegraf, { ContextMessageUpdate, Context } from 'telegraf';
import axios from 'axios';
import { parse } from 'node-html-parser';

import logger from './utils/logger'
import { TELEGRAM_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN, SPOTIFY_SECRET } from './utils/secrets';

const allowedServices = [
    { id: 'open.spotify.com', name: 'Spotify' },
    { id: 'music.apple.com', name: 'Apple Music' }
];

const spotifyApiBaseURL = 'https://api.spotify.com/v1';

interface MusicData {
    artist: string,
    album: string,
    song?: string
}

const apiKey = TELEGRAM_API_KEY || '';

const bot = new Telegraf(apiKey);
bot.start((ctx: ContextMessageUpdate) => ctx.reply('Welcome'));
bot.help((ctx: ContextMessageUpdate) => ctx.reply('Send me a sticker'));
bot.on('text', async (ctx: ContextMessageUpdate) => {
    const message = ctx.update.message?.text || '';
    const messageIncludeLink = allowedServices.some(({ id }) => message.includes(id));

    if (messageIncludeLink) {
        // console.log(message)
        let res = '';
        try {
            res = await getSpotifyURL(message);
            getSpotifyDataByURL(res);
        } catch (error) {
            res = '😢 ' + error.message;
        }

        if (res) {
            ctx.replyWithHTML(res);
        }
    }
});

bot.launch();


async function getSpotifyURL(url: string): Promise<string> {
    // console.log(url)

    if (!url.includes('/album')) {
        return ''
    }

    try {
        const songData = await getAppleMusicDataByURL(url);

        const queryString = cleanString(`${songData.artist} ${songData.song ? songData.song : songData.album}`);

        const spotifyData = await getSpotifyData(songData.song ? 'track' : 'album', queryString);

        const searchCollection = songData.song ? spotifyData.tracks : spotifyData.albums;

        if (searchCollection?.total) {
            return searchCollection.items[0].external_urls.spotify;
        } else {
            const errorMsg = `Cant find spotify data for query: <b>${queryString}</b>`;
            logger.warn(errorMsg);
            throw new Error(errorMsg);
        }

    } catch (error) {
        throw error;
    }

}

async function getAppleMusicDataByURL(url: string): Promise<MusicData> {
    let resData: MusicData = {
        artist: '', album: ''
    }
    try {
        const res = await axios.get(url);
        const root = parse(res.data);

        resData.album = root.querySelector('.album-header .product-header__title').text?.trim();
        resData.artist = root.querySelector('.album-header .album-header__identity a').text.trim();
        const song = root.querySelector('.product-hero__tracks table .is-deep-linked .table__row__titles .we-selectable-item__link-text__headline')?.text;
        if (song) {
            resData.song = song.trim();
        }

        return resData
    } catch (error) {
        throw new Error('Error while parsing AppleMusic data! --> ' + error.message);
    }
}

async function getSpotifyData(type: string, queryString: string) {

    try {
        const accessToken = await getSpotifyAccessToken();

        const res = await axios({
            method: 'get',
            url: `https://api.spotify.com/v1/search?q=${encodeURI(queryString)}&type=${type}`,
            responseType: 'json',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
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

async function getSpotifyDataByURL(url:string): Promise<MusicData> {
    const replaceArr = [
        {from: 'https://open.spotify.com', to: spotifyApiBaseURL},
        {from: 'track', to: 'tracks'},
        {from: 'album', to: 'albums'},
    ];
    const supportedTypes = ['track', 'album'];
    const allowedLink = supportedTypes.some(el => url.includes(el));
    if (!allowedLink) {
        throw new Error('Unsupported link');
    }
    let reqUrl = url;
    replaceArr.forEach(el => {
        reqUrl = reqUrl.replace(el.from, el.to);
    })
    try {
        const res = await axios.get(reqUrl, {
            headers: {
                'Authorization': `Bearer ${await getSpotifyAccessToken()}`
            }
        });

        // console.log(res.data);
        const itIsAlbum = res.data.type === 'album';

        const resultData: MusicData = {
            artist: res.data.artists['0'].name,
            album: itIsAlbum ? res.data.name : res.data.album.name
        };

        if (!itIsAlbum) {
            resultData.song = res.data.name
        }

        return resultData

    } catch (error) {
        throw new Error('Error while receiving spotify data. ' + error.message);
    }
}

function cleanString(str: string) {
    const words = [
        ' - EP',
        '[Deluxe Version]',
        'feat.'
    ];

    let newStr = str;
    words.forEach(el => newStr = str.replace(el, ''))
    return newStr;
}
