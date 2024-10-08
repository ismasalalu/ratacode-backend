const express = require('express');
const router = express.Router();
const axios = require('axios'); // Add this line to import axios
const { searchById } = require('../../database/getMangaInfo');
const { getLatestManga } = require('../../database/getRandomData');
const { chapterImage } = require('../../database/getChapterImage');

const getRandomManga = async () => {
    return await getRandomData();
};

const getMangaInfo = async (mangaId) => {
    try {
        const manga = await searchById(mangaId);
        if (manga) {
            const mangaInfo = JSON.parse(JSON.stringify(manga));
            if (mangaInfo.chapters) {
                mangaInfo.chapters.forEach(chapter => {
                    delete chapter.image_urls;
                });
            }
            return mangaInfo;
        }
        return null;
    } catch (error) {
        console.error('Error in getMangaInfo:', error);
        return null;
    }
};

const getChapterImages = async (mangaId, chapterId) => {
    const manga = await chapterImage(mangaId, chapterId);
    if (manga && manga._id == mangaId) {
        const chapter = manga.chapters.find(ch => ch._id == chapterId);
        return chapter ? chapter.image_urls : [];
    }
    return [];
};


// ================== ROUTES ==================


router.get('/getManga', async (req, res) => {
    console.log('GET /getManga route accessed');
    try {
        //console.log('Calling getLatestManga function');
        const latestManga = await getLatestManga();
        //console.log(`Retrieved ${latestManga.length} manga`);
        res.status(200).json(latestManga);
    } catch (error) {
        console.error('Error in getManga route:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});



router.get('/:mangaId/:chapterId?', async (req, res) => {
    const { mangaId, chapterId } = req.params;
    //console.log('Requested mangaId:', mangaId);

    if (chapterId) {
        const imageUrls = await getChapterImages(mangaId, chapterId);

        if (imageUrls.length === 0) {
            return res.status(404).send('Chapter not found');
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://manganato.com/'
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.write('[');

        let isFirst = true;
        for (const url of imageUrls) {
            try {
                const imageResponse = await axios.get(url, {
                    headers: headers,
                    responseType: 'arraybuffer',
                    timeout: 10000
                });

                const image = {
                    contentType: imageResponse.headers['content-type'],
                    data: imageResponse.data.toString('base64')
                };

                if (!isFirst) {
                    res.write(',');
                }
                res.write(JSON.stringify(image));
                // Remove res.flush() as it's not necessary
                isFirst = false;
            } catch (error) {
                console.error(`Failed to fetch image: ${url}`, error);
                // Continue with the next image if one fails
            }
        }
        res.write(']');
        res.end();
    } else {
        //console.log('Fetching manga info for id:', mangaId);
        const mangaInfo = await getMangaInfo(mangaId);
        //console.log('Retrieved mangaInfo:', mangaInfo);
        if (!mangaInfo) {
            //console.log('Manga not found in database');
            return res.status(404).send('Manga not found');
        }
        res.json(mangaInfo);
    }
});

module.exports = router;