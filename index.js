const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    cors: { origin: '*' }
});
const bodyParser = require('body-parser');

app.use(bodyParser.json());

// Вместо БД используем коллекции Map()
const rooms = new Map();

// Получение данных конкретной комнаты чата
// Если комната существует, то подгружаются списки сообщений и пользователей
app.get(`/rooms/:id`, (req, res) => {
    const roomId = req.params.id;
    const obj = rooms.has(roomId) ? {
        users: [...rooms.get(roomId).get('users').values()],
        messages: [...rooms.get(roomId).get('messages').values()]
    } : { users: [], messages: [] };
    res.json(obj);
});

// Отправка данных для входа в комнату
app.post('/rooms', (req, res) => {
    const { roomId, userName } = req.body;
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map([
            ['users', new Map()],
            ['messages', []]
        ]));
    }
    res.send();
});

// Подключение сокетов
io.on('connection', socket => {

    // Присоединение к комнате пользователей
    socket.on('room join', ({ roomId, userName }) => {
        socket.join(roomId);
        rooms.get(roomId).get('users').set(socket.id, userName);

        // Отправка онлайн пользователей
        const users = [...rooms.get(roomId).get('users').values()];
        socket.to(roomId).broadcast.emit('room joined', users);
    });

    // Получение и сохранение сообщений чата
    socket.on('room message', ({ roomId, userName, text, date }) => {
        const obj = { userName, text, date };
        rooms.get(roomId).get('messages').push(obj);
        socket.to(roomId).broadcast.emit('room message', obj);
    });

    // Запуск начала видеотрансляции 
    socket.on('streamOn', (obj, roomId) => {
        socket.to(roomId).broadcast.emit('streamOn', obj);
    });


    // Отключение видеотрансляции
    socket.on('streamOff', (obj, roomId) => {
        socket.to(roomId).broadcast.emit('streamOff', obj);
    });


    // Получение актуального списка пользователей комнаты
    socket.on('disconnect', () => {
        rooms.forEach((value, roomId) => {
            if (value.get('users').delete(socket.id)) {
                const users = [...value.get('users').values()];
                socket.to(roomId).broadcast.emit('room left', users);
            }
        });
    });
});

http.listen(3000, (err) => {
    if (err) throw Error(err);
    console.log('Server working!');
});