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





// Add a connect listener
io.sockets.on('connection', function(socket){ 
	socket.on('message',function(event){ 
		console.log('Message: ',event);
		if (event=="requestinggeocodes"){
			sendOutExistingLocations(socket);
		}
	});
	socket.on("join", function(roomname) {
		console.log("socket joined "+roomname);
		socket.join(roomname);
	});
});


// --------- Mongo-related functions -----------
//Setup: if I'm running this locally, apikeys.js contains my keys; on Heroku, it's an env variable.
var mongoUri;
var twilioAccount;
var twilioAuth;
var twilioNumber;
var leacode;

try {
	var keys = require("./apikeys.js");
	mongoUri = keys.mongoURL;
	twilioAccount = keys.twilioAccount;
	twilioAuth = keys.twilioAuth;
	twilioNumber = keys.twilioNumber;
	leacode = keys.leacode
}
catch (e) {
	mongoUri = process.env.MONGOHQ_URL;
	twilioAccount = process.env.TWILIO_SID;
	twilioAuth = process.env.TWILIO_AUTH;
	twilioNumber = process.env.TWILIO_NUMBER;
	leacode = proces.env.LEACODE
}

var mongo = require('mongodb'); //https://npmjs.org/package/mongodb

var twilio = require('twilio')(twilioAccount, twilioAuth);


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



function sendMessage(recipient, content) {
	twilio.sendMessage({to: recipient, from: twilioNumber, body: content}, function(err, responseData) {
		if (err) {
			console.log("Twilio error:")
			console.log(err);
		}
		else {
			var time = new Date;
			putInDB("transcript", {"sender":"me", "content": content, "time": time})
		}
	})
}

// -------- Functions for mapping activity ------------
var geocoder = require('geocoder');
function participantMap(sender, content) {
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

// ---------------- Wikipedia swap -----------------
// "Text in an excellent Wikipedia article to receive one in return."
function storeWikipediaArticles(sender, content) {
	var contribution = {"contributor": sender, "content": content}
	mongo.Db.connect(mongoUri, function (err, db) {
		db.collection("wikipedias").update({"status":"active"}, { $push: {"contributions":contribution}}), {w:1}, function(err) {
			if (err){
				console.log(err);
			}
			else {
				console.log("Gamestate is now: "+newstate);
			}
	    });
	});
}

function distributeWikipedias() {

}


// ---------- Two truths and a lie Part 1-----------
// "Text in something true and/or something false.
// Prepend a true statement with a 'T' and a false one with 'F'; for example:
// "T Los Vegas is west of Los Angeles." or "F !!Con is boring."

function logTrueFalse(sender, content) {

}


// ---------- Two truths and a lie Part 2-----------
// "Send in a txt consisting of a T or F for the truth or falseness of the following statements.
// First one to get all correct wins!
// "Example txt: 'T T F F T F T'"

function scoreTrueFalse(player, response) {
	responseArray = response.toUpperCase().replace(/[^FT]/g,"").split("");
	mongo.Db.connect(mongoUri, function (err, db) {
		db.collection("answerkeys").find({"status":"active"}).nextObject(function (err, doc) {
			var answerkey = doc.key;
			var score = 0;
			// Don't try to index out of either array's bounds
			var checklength = responseArray.length;
			if (answerkey.length < checklength) {
				checklength = answerkey.length
			}
			for (var i =  0; i < checklength; i++) {
				if (answerkey[i] == responseArray[i]) {
					score = score+1;
				}
			};
			sendMessage(player, "Your score: "+score);
		});
	});	
}


// -------- Handle Twilio POST ---------------------
app.post('/twilio', function(req, res) {
	var sender = req.body.From;
	var content = req.body.Body;
	console.log(content);
	if (content) {
		mongo.Db.connect(mongoUri, function (err, db) {
			var time = new Date;
			db.collection("transcript").insert({"sender":sender, "content": content, "time": time});
			db.collection("game").find({"status":"active"}).nextObject(function (err, doc) {
				var gamemode = doc.mode;
				console.log(doc.mode);
				switch (gamemode) {
					case "map":
						participantMap(sender, content);
					case "acquiringtruefalse":
						logTrueFalse(sender, content);
					case "truefalse":
						scoreTrueFalse(sender, content);
				}
			});
		});	
	} 
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.end();
});


// Sekkrit game-advancing commands.
// Access via: curl -d "pw=****&command=changestate&newstate=map" http://bangbanggames.herokuapp.com/sekkritcommand
// or: curl -d "pw=****&command=action&action=distributewikipedias" http://bangbanggames.herokuapp.com/sekkritcommand
// Possible game states: map, aquiringtruefalse, truefalse, aquiringwikipedias
// Possible GM actions: distributewikipedias
app.post('/sekkritcommand', function(req,res) {
	if (req.body.pw == leacode) {
		var command = req.body.command;
		if (command == "changestate"){
			changeGameState(req.body.newstate);
		}
		if (command == "action") {
			var action = req.body.action;
			if (action == "distributewikipedias") {
				distributewikipedias();
			}
		}

	}
	else {
		res.writeHead(403, {"Content-Type": "text/plain"});
		res.end();
	}
})

function changeGameState(newstate) {
	mongo.Db.connect(mongoUri, function (err, db) {
		db.collection("game").update({"status":"active"}, { $set: {"mode":newstate}}), {w:1}, function(err) {
			if (err){
				console.log(err);
			}
			else {
				console.log("Gamestate is now: "+newstate);
			}
	    });
	});
}


// TODO:
// two truths and a lie
// wikipedia swap
// crowd-driven CYOA
// index redirects to current activity?



