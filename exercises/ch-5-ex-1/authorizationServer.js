var express = require("express");
var url = require("url");
var bodyParser = require('body-parser');
var randomstring = require("randomstring");
var cons = require('consolidate');
var nosql = require('nosql').load('database.nosql');
var querystring = require('querystring');
var __ = require('underscore');
__.string = require('underscore.string');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for the token endpoint)

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/authorizationServer');
app.set('json spaces', 4);

// authorization server information
var authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information
var clients = [

  /*
   * Enter client information here
   */
	{
		"client_id": "oauth-client-1",
		"client_secret": "oauth-client-secret-1",
		"redirect_uris": ["http://localhost:9000/callback"]
	}
];

var codes = {};

var requests = {};

var getClient = function(clientId) {
	return __.find(clients, function(client) { return client.client_id == clientId; });
};

app.get('/', function(req, res) {
	res.render('index', {clients: clients, authServer: authServer});
});

app.get("/authorize", function(req, res){
	
	/*
	 * Process the request, validate the client, and send the user to the approval page
	 */
	let client = getClient(req.query.client_id);

	if (!client) {
		res.render('error', {error: "Unknown client'"});
	}

	/*
	Usually, a login form will be presented to the user, but in this exercise we directly show the approve screen
	 */

	let reqid = randomstring.generate(8);
	requests[reqid] = req.query;

	res.render('approve', {client: client, reqid: reqid});
	
});

app.post('/approve', function(req, res) {

	/*
	 * Process the results of the approval page, authorize the client
	 */
	let initialRequest = requests[req.body.reqid];
	delete requests[req.body.reqid];
	if (!initialRequest) {
		res.render('error', {error: "Unknown request id'"});
	}

	if (!(req.query.redirect_uri && __.contains(initialRequest.client.redirect_uris, req.query.redirect_uri))) {
		res.render('error', {error: "Invalid"});
	}

	if (req.body.approve == 'Approve') {
		if (initialRequest.response_type === 'code') {
			let code = randomstring.generate(8);
			codes[code] = {request: initialRequest};
			var urlParsed = buildUrl(initialRequest.redirect_uri, {
				code: code,
				state: initialRequest.state
			});
			res.redirect(urlParsed);
			return;
		} else {
			var urlParsed = buildUrl(initialRequest.redirect_uri, {error: "unsupported_response_type"});
			res.redirect(urlParsed);
			return;
		}

	} else {
		var urlParsed = buildUrl(initialRequest.redirect_uri, {error: "access_denied"});
		res.redirect(urlParsed);
		return;
	}
});

app.post("/token", function(req, res){

	/*
	 * Process the request, issue an access token
	 */
	// 1. authenticate (client_id + secret)
	// 2. als grant_type == authorization_code, dan code opzoeken
	// 3. als bestaat, dan aanmaken access token en redirecten naar redirect_uri

	let authorizationHeader = req.header('Authorization');
	if (!authorizationHeader) {
		var urlParsed = buildUrl(initialRequest.redirect_uri, {error: "access_denied"});
		res.redirect(urlParsed);
		return;
	}

	let clientCredentials = decodeClientCredentials(authorizationHeader);
	var clientId = clientCredentials.id;
	var clientSecret = clientCredentials.secret;

	let client = getClient(clientId);
	if (!client) {
		res.status(401).json({error: 'invalid_client'});
	}

	if (client.secret !== clientSecret) {
		res.status(401).json({error: 'invalid_client'});
	}

	if (req.query.response_type === 'authorization_grant') {

	} else {
		res.status(400).json({error: 'invalid grant type'});
	}




});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}
	
	return url.format(newUrl);
};

var decodeClientCredentials = function(auth) {
	var clientCredentials = Buffer.from(auth.slice('basic '.length), 'base64').toString().split(':');
	var clientId = querystring.unescape(clientCredentials[0]);
	var clientSecret = querystring.unescape(clientCredentials[1]);	
	return { id: clientId, secret: clientSecret };
};

app.use('/', express.static('files/authorizationServer'));

// clear the database
nosql.clear();

var server = app.listen(9001, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('OAuth Authorization Server is listening at http://%s:%s', host, port);
});
 
