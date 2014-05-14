var http = require('http')
  , express = require('express')
  , app = express()
  , port = process.env.PORT || 5000;

app.use(express.static(__dirname + '/public'));
var bodyParser = require('body-parser');
app.use(bodyParser());


var server = http.createServer(app);
server.listen(port, function() { console.log(this._connectionKey)});

console.log('http server listening on %d', port);


// // Create a Socket.IO instance, passing it our server
// var io = require('socket.io').listen(server);
// io.set('log level', 1);


// //Mongo setup
// var keys = require("./apikeys.js");
// var mongo = require('mongodb'); //https://npmjs.org/package/mongodb
// var mongoUri = keys.mongoURL;

// // Add a connect listener
// io.sockets.on('connection', function(socket){ 
// 	socket.on('message',function(event){ 
// 		console.log('Message: ',event);
// 		if (event=="hello"){
// 			sendOutExistingLocations(socket);
// 		}
// 	});
// });

// function sendOutExistingLocations(socket) {
// 	mongo.Db.connect(mongoUri, function (err, db) {
// 		if (err) {
// 			console.log(err);
// 		}
// 		var pastGeocodes = db.collection('geocodes').find({});
// 		pastGeocodes.each(function(err, doc) {
// 			if (err) {
// 				console.log(err);
// 			}
// 			else {
// 				console.log(doc);
// 				socket.emit("geocode", doc);
// 			}
// 		});
// 	});
// }


// var geocoder = require('geocoder');

app.post('/twilio', function(req, res) {
	// var content = req.body.Body;
	console.log(req.body);
	// if (content) {
	// 	// geocoder.geocode(content, function ( err, data ) {
	// 	// 	if (data) {
	// 	// 		console.log(data)
	// 	// 	}
	// 	//   // io.sockets.broadcast.emit(data)
	// 	// });
		
	// } 
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.write("ok");
	res.end();
});







