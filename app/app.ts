import Telegraf, { ContextMessageUpdate } from 'telegraf';
import axios from 'axios';
import { parse, HTMLElement } from 'node-html-parser';
import qs from 'querystring';

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
    // const messageIncludeLink = allowedServices.some(({ id }) => message.includes(id));

    let respMsg = '';

    try {
        if (message.includes('music.apple.com')) {
            // console.log(message)
            respMsg = await getSpotifyURL(message);
        } else if (message.includes('open.spotify.com')) {
            const spotifyData = await getSpotifyDataByURL(message);
            respMsg = await getAppleMusicURL(spotifyData);
        } else {
            respMsg = 'Unsupported data 🤷‍♂️';
        }
    } catch (error) {
        respMsg = '😢 ' + error.message;
    }

    if (respMsg) {
        ctx.replyWithHTML(respMsg);
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
            const errorMsg = `Cant find spotify data for query: ${queryString}, URL: ${url}`;
            logger.warn(errorMsg);
            throw new Error(`Cant find spotify data for query: <b>${queryString}</b>`);
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

        if (root.valid) {
            resData.album = (<HTMLElement>root).querySelector('.album-header .product-header__title').text.trim();
                  
            let artist = (<HTMLElement>root).querySelector('.product-hero__tracks table .is-deep-linked .table__row__titles .we-selectable-item__link-text__subcopy')?.text;
            if (!artist) {
                artist = (<HTMLElement>root).querySelector('.album-header .album-header__identity').text.trim();
            }
            resData.artist = artist;

            const song = (<HTMLElement>root).querySelector('.product-hero__tracks table .is-deep-linked .table__row__titles .we-selectable-item__link-text__headline')?.text;
            if (song) {
                resData.song = song.trim();
            }
        } else {
            throw new Error("HTML response does not valid");
        }

        return resData;

    } catch (error) {
        logger.error('Error while parsing AppleMusic data! --> ' + error.message + ' | URL: ' + url);
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
                'Authorization': 'Bearer ' + accessToken
            }
        });
        // console.log(res.data.tracks.items)
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

async function getSpotifyDataByURL(url: string): Promise<MusicData> {
    const replaceArr = [
        { from: 'https://open.spotify.com', to: spotifyApiBaseURL },
        { from: 'track', to: 'tracks' },
        { from: 'album', to: 'albums' },
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

async function getAppleMusicURL(data: MusicData): Promise<string> {
    const baseURL = 'https://itunes.apple.com/search?';
    let url = `${baseURL}${qs.stringify({
        'term': data.artist + ' ' + data.album + (data.song ? ' ' + data.song : ''),
        'media': 'music',
        'entity': data.song ? 'song' : 'album'
    })}`

    // console.log(data);
    try {
        const res = await axios.get(url);
        // console.log(res.data);
        if (res.data.resultCount) {
            const foundData = res.data.results[0];
            return data.song ? foundData.trackViewUrl : foundData.collectionViewUrl;
        } else if(data.song) {
            url = `${baseURL}${qs.stringify({
                'term': data.artist + ' ' + data.song,
                'media': 'music',
                'entity': 'song'
            })}`
            const res = await axios.get(url);
            if (res.data.resultCount) {
                return res.data.results[0].collectionViewUrl;
            }
        }

        logger.warn('iTunes data not fond. Link: ' + url);
        return 'Not found 😢';

    } catch (error) {
        logger.error('Error while getting AppleMusic link. <' + url + '> ' + error.message);
        throw error;
    }
}

function cleanString(str: string) {
    const words = [
        ' - EP',
        '[Deluxe Version]',
        'feat. ',
        'Edition',
        ' - Single'
    ];

    let newStr = str;
    words.forEach(el => newStr = newStr.replace(el, ''))
    return newStr;
}
