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


// Create a Socket.IO instance, passing it our server
var io = require('socket.io').listen(server);
io.set('log level', 1);


//Mongo setup: if I'm running this locally, apikeys.js contains my keys; on Heroku, it's an env variable.
var mongoUri;
try {
	var keys = require("./apikeys.js");
	mongoUri = keys.mongoURL;
}
catch (e) {
	mongoUri = process.env.MONGOHQ_URL;
}
var mongo = require('mongodb'); //https://npmjs.org/package/mongodb


// Add a connect listener
io.sockets.on('connection', function(socket){ 
	socket.on('message',function(event){ 
		console.log('Message: ',event);
		if (event=="requestinggeocodes"){
			sendOutExistingLocations(socket);
		}
	});
});

// For the map, the client sends out a request for all the existing locations;
// pull them from the "geocodes" and emit them out
function sendOutExistingLocations(socket) {
	mongo.Db.connect(mongoUri, function (err, db) {
		if (err) {
			console.log(err);
		}
		var pastGeocodes = db.collection('geocodes').find({});
		pastGeocodes.each(function(err, doc) {
			if (err) {
				console.log(err);
			}
			else {
				console.log(doc);
				socket.emit("geocode", doc);
			}
		});
	});
}

function putInDB(collection, record) {
	mongo.Db.connect(mongoUri, function (err, db) {
	    if (err) {
	    	console.log(err);
	    }
	    db.collection(collection).insert(record, function (err, docs) {
	    	if (err) {
	    		console.log(err);
	    	}
	    	else {
	    		console.log("Inserted document into collection "+collection);
	    	}
	    });
	  });
}

var geocoder = require('geocoder');

app.post('/twilio', function(req, res) {
	var content = req.body.Body;
	console.log(content);
	if (content) {
		geocoder.geocode(content, function ( err, data ) {
			if (err) {
				var record = {};
			}
			if (data) {
				if (data.status == "OK") {
					console.log(data.results[0].geometry)
					var latitude = data.results[0].geometry.location.lat;
					var longitude = data.results[0].geometry.location.lng;
					var placename = content;
					var record = {"placename":placename, "latitude": latitude, "longitude": longitude, "status":"OK"};
					putInDB('geocodes', record);
					io.sockets.in("map").emit("geocode", record);
				}
			}
		});
		
	} 
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.end();
});







