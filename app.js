const express = require("express");
const https = require("https");
const bodyparser = require('body-parser');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static(__dirname));


mongoose.connect('mongodb+srv://oskosk:rgq900zhIfpuzXHb@clusterosk.gkcmuu4.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Error connecting to MongoDB Atlas:', err));


const weatherSchema = new mongoose.Schema({
  city: String,
  temp: Number,
  description: String,
  icon: String,
  coordin1: Number,
  coordin2: Number,
  flslike: Number,
  humidity: Number,
  pressure: Number,
  windspeed: Number,
  councode: Number,
  rain: Number,
  imageURL: String,
  wikiExtract: String,
  photoURL: String 
});

const Weather = mongoose.model('Weather', weatherSchema);


const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);



app.get('/', function (req, res) {
    res.sendFile(__dirname + '/logen.html');
});

app.post("/register", async function (req, res) {
    
    const username = req.body.username;
    const password = req.body.password;

    // проверка, существует ли пользователь с таким именем
    const existingUser = await User.findOne({ username: username }).exec();
    if (existingUser) {
        return res.send('User with this username already exists');
    }

    // создание нового пользователя
    const newUser = new User({
        username: username,
        password: password
    });

    // сохранение пользователя в базе данных
    newUser.save()
        .then(savedUser => {
            // перенаправление обратно на страницу входа после успешной регистрации
            res.redirect('/logen.html');
        })
        .catch(err => {
            console.error('Error saving user to MongoDB:', err);
            res.send('Error saving user to MongoDB');
        });
});

app.post("/login", async function (req, res) {
    // получение данных из формы
    const username = req.body.username;
    const password = req.body.password;
     
 // проверка администраторских учетных данных
 if (username === 'aliaskar' && password === 'aliaskar2591') {
    // если учетные данные верны, перенаправляем на административную панель
    res.redirect('/adminpanel');
} else {
    // если учетные данные не администраторские, обрабатываем их как обычный вход
    const user = await User.findOne({ username: username, password: password }).exec();
    if (!user) {
        return res.send('Invalid username or password');
    }

    // перенаправление на страницу weather.html после успешного входа
    res.redirect('/weather.html');
}
});


app.get('/adminpanel', async function (req, res) {
   
    const users = await User.find({}).exec();
    
    const weatherData = await Weather.find({}).exec();
    
    res.render(path.join(__dirname, 'adminpanel.ejs'), { users: users, weatherData: weatherData });
});

app.post("/admin/adduser", async function (req, res) {
    const { username, password } = req.body;
    
    const existingUser = await User.findOne({ username: username }).exec();
    if (existingUser) {
        return res.send('User with this username already exists');
    }

    const newUser = new User({
        username: username,
        password: password
    });

    // сохранить нового пользователя в базу данных
    newUser.save()
        .then(savedUser => {
            // перенаправить обратно на административную панель
            res.redirect('/adminpanel');
        })
        .catch(err => {
            console.error('Error saving user to MongoDB:', err);
            res.send('Error saving user to MongoDB');
        });
});

app.post("/admin/deleteuser", async function (req, res) {
    const userId = req.body.userId;
    
    await User.findByIdAndDelete(userId).exec();
    
    res.redirect('/adminpanel');
});

app.post("/admin/deleteuser/:userId", async function (req, res) {
    const userId = req.params.userId;
    try {
        await User.findByIdAndDelete(userId);
        res.redirect('/adminpanel');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Error deleting user');
    }
});


app.post("/", function (req, res) {
    var city = req.body.ccity;

    const weatherApiUrl = "https://api.openweathermap.org/data/2.5/weather?q=" + city + "&appid=7f923b2e7e73e7bb65d765e5c7fc0b11&units=metric";

    https.get(weatherApiUrl, function (weatherResponse) {
        weatherResponse.on("data", function (weatherData) {
            const weatherdata = JSON.parse(weatherData);
            if (weatherdata.cod === '404') {
                res.render(__dirname + '/result.ejs', { message: 'CITY NOT FOUND' })
            } else {
                const newWeatherData = new Weather({
                    city: city,
                    temp: weatherdata.main.temp,
                    description: weatherdata.weather[0].description,
                    icon: weatherdata.weather[0].icon,
                    coordin1: weatherdata.coord.lon,
                    coordin2: weatherdata.coord.lat,
                    flslike: weatherdata.main.feels_like,
                    humidity: weatherdata.main.humidity,
                    pressure: weatherdata.main.pressure,
                    windspeed: weatherdata.wind.speed,
                    councode: weatherdata.id,
                    rain: weatherdata.rain && weatherdata.rain['3h'] ? weatherdata.rain['3h'] : 0,
                    imageURL: "https://openweathermap.org/img/wn/" + weatherdata.weather[0].icon + "@2x.png",
                });

                axios.get(`https://api.unsplash.com/photos/random?query=${city}&client_id=_qqGNkOnSEmqRqIANLFT2A_WC0tBUlD8yy6Pjmt9PsA`)
                    .then((unsplashResponse) => {
                        const photoURL = unsplashResponse.data.urls.regular;
                        newWeatherData.photoURL = photoURL; // Сохраняем URL фотографии в объекте новых данных о погоде
                        newWeatherData.save()
                            .then(savedWeather => {
                                Weather.findOne({ city: city }).exec()
                                    .then(weather => {
                                        if (!weather) {
                                            res.render(__dirname + '/result.ejs', { message: 'Weather data not found' });
                                            return;
                                        }

                                        const wikipediaApiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${city}&origin=*`;
                                        axios.get(wikipediaApiUrl)
                                            .then((wikipediaResponse) => {
                                                const pageId = Object.keys(wikipediaResponse.data.query.pages)[0];
                                                const wikiExtract = wikipediaResponse.data.query.pages[pageId].extract;

                                                // Обновление модели данных с данными из википедии перед выводом
                                                weather.wikiExtract = wikiExtract;

                                                res.render(__dirname + '/result.ejs', { weather: { ...weather._doc, photoURL: savedWeather.photoURL } });
                                            })
                                            .catch((error) => {
                                                console.error("Error fetching Wikipedia data", error);
                                                res.send("Error fetching Wikipedia data");
                                            });
                                    })
                                    .catch(err => {
                                        console.error("Error finding weather data in MongoDB:", err);
                                        res.send("Error finding weather data in MongoDB");
                                    });
                            })
                            .catch(err => console.error('Error saving weather data to MongoDB:', err));
                    })
                    .catch((error) => {
                        console.error("Error fetching Unsplash data", error);
                        res.send("Error fetching Unsplash data");
                    });
            }
        });
    });
});

const port = process.env.PORT || 3000; 

app.listen(port, function () {
    console.log(`Server started on ${port}`);
});





