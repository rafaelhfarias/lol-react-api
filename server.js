
const express = require('express')
const http = require('http')
const socket = require('socket.io')
const axios = require('axios')
const util = require('util');
const path = require('path');



const SERVER_PORT = process.env.PORT || 5000;

//KOA SETTINGS
const app = new express()
const server = http.createServer(app)
const io = socket(server);


let selectedGameId = null;



io.on('connection', (socket) => {
    console.log("[SOCKET.IO] We have a new connection!")

    setInterval(() => {
        updateScoreBoard().then(gameStats => {
            socket.emit('updateScoreBoard', gameStats)
        });

    }, 1000)

    socket.on('disconnect', () => {
        console.log("[SOCKET.IO] User had left")
    })
})


// partidas do dia
app.get('/games/:id', async (req,getRes) => {
    console.log("Liga selecionada: ", req.params.id)
    await axios.get(`https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=pt-BR&leagueId=${req.params.id}`,
        {
            headers:
                { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
        })
        .then((res) => {
            console.log("Data: ",req.query.date)
            if (res.data.data != null) {
                let events = res.data.data.schedule.events.filter((el) => {
                    return new Date(el.startTime).getDate() == new Date(req.query.date).getDate() &&
                        new Date(el.startTime).getMonth() == new Date(req.query.date).getMonth() &&
                        new Date(el.startTime).getFullYear() == new Date(req.query.date).getFullYear() &&
                        el.hasOwnProperty('match')
                }).map((el) => {
                    //      console.log(util.inspect(el, { depth: null }));
                    return { id: el.match.id, match: `${el.match.teams[0].name} x ${el.match.teams[1].name}` };
                })

                //   console.log(util.inspect(events, { depth: null }));

                getRes.send(events)

            }

        }).catch((err) => {
            console.log('[ERROR]: ', err);
        })
})

app.get('/setgame/', async (req,res) => {
    selectedGameId = null
    console.log("Nenhuma partida selecionada")
    res.send("Sucess!!")

})

app.get('/setgame/:id', async (req,res) => {
    if (req.params.id == null) selectedGameId = null
    selectedGameId = String(BigInt(req.params.id) + BigInt(1))
    console.log("Partida selecionada: ",util.inspect(req.params, { depth: null }))
    console.log(selectedGameId)
    res.send("Sucess!!")

})



//
const updateScoreBoard = async () => {
    if (selectedGameId == null) return;
    let startingTime = getRoundedDate(10).toISOString(); // '2021-02-17T14:08:00Z'
    //let startingTime = '2021-02-17T14:08:00Z';

    const apiUrl = 'https://feed.lolesports.com/livestats/v1/window/' + (selectedGameId) + '?startingTime=' + startingTime;
    var myInit = {
        headers: { 'x-api-key': '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z' }
    };


    let gameStats = await axios.get(apiUrl, myInit)
        .then(res => {
            if (res.status != 200) {
                return Promise.reject({ err: res.status });
            }

            let data = res.data;

            if (data == null || data.frames == null) return;
            let lastFrame = data.frames.pop();
            let metadata = data.gameMetadata;

            //blue team stats
            let blueTeamStats = lastFrame.blueTeam
            let redTeamStats = lastFrame.redTeam

            let blueTeamMetadata = metadata.blueTeamMetadata
            let redTeamMetadata = metadata.redTeamMetadata


            console.log("[SCOREBOARD] - UPDATED")

            return { blueTeamStats: blueTeamStats, redTeamStats: redTeamStats, blueTeamMetadata: blueTeamMetadata, redTeamMetadata: redTeamMetadata }

        }).catch(err => {
            console.log("[ERROR] - " + util.inspect(err, { depth: null }))
        })

    return gameStats
}



//

let getRoundedDate = (seconds, d = new Date()) => {

    let ms = 1000 * seconds; // convert minutes to ms
    let roundedDate = new Date(Math.round((d.getTime() - 28000) / ms) * ms);

    return roundedDate
}

app.use(express.static(path.join(__dirname, 'build')));


app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


server.listen(SERVER_PORT, () => {
    console.log(`[HTTP] Listen => Server is running...`)
})