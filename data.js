/*
Copyright 2015 Shubham Naik // HubYard

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

var express = require('express');
var http = require('http');
var https = require('http');
var path = require('path');
var fs = require('fs');
var app = express();
var moment = require('moment');
var crypto = require('crypto');
var MongoDB 	= require('mongodb').Db;
var Server 		= require('mongodb').Server;
var mongojs = require('mongojs');
var keys = require('./keys');


var rank_check = function(rank, sent, action){
    if(rank === 'enthusiast'){
        if(action === 'network' && sent > 4){ 
            return false;
        } else if(action === 'network' && sent <= 4){ 
           return true;
        } else if(action === 'canvas' && sent > 1){ 
           return false;
        } else if(action === 'canvas' && sent <= 1){ 
           return true;
        } else if(action === 'RSS' && sent > 4){ 
            return false;
        } else if(action === 'RSS' && sent <= 4){ 
           return true;
        } else if(action === 'canvasmembers' && sent > 0){ 
            return false;
        }
    } else if(rank === 'entrepreneurbetamonthly' || rank === 'entrepreneurbetayearly'){
        if(action === 'network' && sent > 24){ 
            return false;
        } else if(action === 'network' && sent <= 24){ 
           return true;
        } else if(action === 'canvas' && sent > 14){ 
           return false;
        } else if(action === 'canvas' && sent <= 14){ 
           return true;
        } else if(action === 'RSS' && sent > 25){ 
            return false;
        } else if(action === 'RSS' && sent <= 25){ 
           return true;
        } else if(action === 'canvasmembers' && sent > 2){ 
            return false;
        } else if(action === 'canvasmembers' && sent <= 2){ 
           return true;
        } 
    }
}



module.exports = function(app) {	

    
    //request pages
	app.get('/', function(req, res) {
		if (req.cookies.user == undefined || req.cookies.pass == undefined){
			res.render('home', {useheader:true});
		}	else{
	// attempt automatic login //
			autoLogin(req.cookies.user, req.cookies.pass, function(o){
				if (o != null){
				    req.session.user = o;
					res.redirect('/app'); 
				}	else{
					res.render('home', {useheader:true});
				}
			});
		}
		
	});
    
    app.get('/terms', function(req, res) {
        res.render('terms', {useheader:true});
    });
    
    app.get('/privacy', function(req, res) {
        res.render('privacy', {useheader:true});
    });
	
	app.get('/login', function(req, res) {
		if (req.cookies.user == undefined || req.cookies.pass == undefined){
			res.render('login');
		}	else{
	// attempt automatic login //
			autoLogin(req.cookies.user, req.cookies.pass, function(o){
				if (o != null){
				    req.session.user = o;
					res.redirect('/app');
				}	else{
					res.render('login');
				}
			});
		}
	});
	
	app.get('/signup', function(req, res) {
		res.render('signup');
	});
	
    //database
	var connection_string = keys.connection_string;

	var db = mongojs(connection_string, ['accounts, canvases, emails, networks']);
	var accounts = db.collection('accounts');
	var networks = db.collection('networks');
	var emails = db.collection('emails');
    var canvases = db.collection('canvases');

	//xss
	var htmlEscape = function(text) {
	   return text.replace(/&/g, '&amp;').
		 replace(/</g, '&lt;').  // it's not neccessary to escape >
		 replace(/"/g, '&quot;').
		 replace(/'/g, '&#039;');
	}
	
	//salt
	var generateSalt = function()
	{
		var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
		var salt = '';
		for (var i = 0; i < 10; i++) {
			var p = Math.floor(Math.random() * set.length);
			salt += set[p];
		}
		return salt;
	}

	
	//hash
	var autoLogin = function(email, pass, callback){
			accounts.findOne({email:email.toLowerCase()}, function(e, o) {
				if (o == null){
					callback(null);
				}	else{
					validatePassword(pass, o.pass, function(err, tet) {
						if (tet){
							o.lastlogin = moment().format('MMMM Do YYYY, h:mm:ss a');
							accounts.save(o, {safe: true}, function(err) {	
								if(err){
									callback(null);
								} else {
									req.session.user = o
									res.redirect('/app');
								}
							});	
						}	else{
							callback(null);
						}
					});
				}
			});
	}
	
	var sha1 = function(str) {
		return crypto.createHash('sha1').update(str).digest('hex');
	}

	var saltAndHash = function(pass, callback)
	{
		var salt = generateSalt();
		callback(salt + sha1(pass + salt));
	}

	var validatePassword = function(plainPass, hashedPass, callback)
	{
        
		var salt = hashedPass.substr(0, 10);
		var validHash = salt + sha1(plainPass + salt);
		callback(null, hashedPass === validHash);
	}
	
	var validateEmail = function(e)
	{
		var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(e);
	}
    
    	app.post('/signup', function(req, res){
		var email = htmlEscape(req.param('email')).toLowerCase();
		var pass = htmlEscape(req.param('pass'));
		var name = htmlEscape(req.param('name'));
		var newData = {};
		if(email != undefined && email != null && email != '' && name != '' && name != undefined && pass != null && pass != undefined && pass != ''){
			if(validateEmail(email) != false){
				emails.findOne({email:email}, function(e, o) {
					if (o){
						accounts.findOne({email:email}, function(e, o) {
							if (o){
								res.send('Email in use, check if you already made an account with us.');
							}	else{
							
								saltAndHash(pass, function(hash){
									newData.email = email;
									newData.pass = hash;
									newData.name = name;
									newData.id = crypto.randomBytes(4).toString('hex') + '_' + crypto.randomBytes(8).toString('hex') + '_' + crypto.randomBytes(4).toString('hex')  + '_' + crypto.randomBytes(16).toString('hex')
								// append date stamp when record was created //
									newData.creationdate = moment().format('MMMM Do YYYY, h:mm:ss a');
									
								// Setup account
									newData.user_rank = 'alpha';
									newData.user_status = 'enthusiast';
                                    newData.options = {}
                                    newData.payment = {}
                                    newData.payment.subscription = '';
                                    newData.payment.last4oncard = '';
                                    newData.options.canvas = 0;
									
									accounts.insert(newData, {safe: true}, function(){
                                        welcometo(newData, function(){
                                            console.log('sent');  
                                        })
										req.session.user = newData;
										res.send(200);
									});
								});
							}
						});
					}	else{
						res.send('Your email is not whitelisted, sign up for our <a href="http://hubyard.com/">newsletter</a> for a chance to get in :)');
					}
				});
			} else {
				res.send('Please enter a valid email.');
			}
		} else {
			res.send('You need to fill in all the fields.');
		}
	});
	
	//login
	app.post('/login', function(req, res) {
		var email = htmlEscape(req.param('email')).toLowerCase();
		var pass = htmlEscape(req.param('pass'));
		if(email != undefined && email != null && pass != null && pass != undefined){
			accounts.findOne({email:email}, function(e, o) {
                
				if (o == null){
					res.send('We recently have locked all accounts until beta testing is open, sorry!');
				}	else{
					validatePassword(pass, o.pass, function(err, tet) {
						if (tet){
							o.lastlogin = moment().format('MMMM Do YYYY, h:mm:ss a');
							accounts.save(o, {safe: true}, function(err) {	
								if(err){
									res.send(err);
								} else {
									req.session.user = o
									if (req.param('remember-me') == 'true'){
										res.cookie('user', o.user, { maxAge: 1080000000 });
										res.cookie('pass', o.pass, { maxAge: 1080000000 });
									}
									res.send(200);
								}
							});	
						}	else{
							res.send('We recently have locked all accounts until beta testing is open, sorry!'); //Your password or username is incorrect.
						}
					});
				}
			});
		} else {
			res.send('You need to fill in all the fields.');
		}
	});
	
	
	
	app.get('/logout', function(req, res){
		if(req.session.user != undefined){
			res.clearCookie('user');
			res.clearCookie('pass');
			req.session.destroy(function(e){ res.redirect('/login') });
		} else {
			res.redirect('/login');
		}
	});
    
    
    
    
    //Actual Tool
	app.get('/app', function(req, res) {
		if(req.session.user != undefined){
            networks.find( { 'member_id' : req.session.user.id } ).toArray(function(e, results) {
				canvases.find( { 'members' : req.session.user.id } ).toArray(function(e, canvases) {
                    res.render('main', {udata:req.session.user, networks:results, canvases:canvases, upgrade:req.param('upgrade')});
                })	
			})	
		} else {
			res.redirect('/login');
		}
	});
    
    //settings
    app.post('/settings/user', function(req, res) {
		if(req.session.user != undefined){
            var email = htmlEscape(req.param('email')).toLowerCase();
            var pass = htmlEscape(req.param('pass'));
            var name = htmlEscape(req.param('name'));
            accounts.findOne({id:req.session.user.id}, function(e, o) {
                if(o){
                    if(pass){
                        if(pass.length >= 5){
                            saltAndHash(pass, function(hash){
                                o.pass = hash;
                                o.name = name;
                                o.email = email;
                                accounts.save(o, {safe: true}, function(err) {	
                                    if(err){
                                        res.send(400);
                                    } else {
                                        res.send(200)
                                    }
                                });	
                            });
                        } else {
                            res.send('Your password is too short (Needs to be 5 or longer)');   
                        }
                    } else {
                        o.name = name;
                        o.email = email;
                        accounts.save(o, {safe: true}, function(err) {	
                            if(err){
                                res.send(400);
                            } else {
                                req.session.user = o;
                                res.send(200)
                            }
                        });	
                    }
                } else {
                    res.send(400);
                }
			});
		} else {
			res.redirect('/login');
		}
	});
    
    /*
        user
        {
            members:[],
            share_id:'543_45',
            id:'53_5'
            
        }
        
        networks
        {
            token:'',
            token_secret:'',
            member_id:'',
            name:'',
            picture:'',
            id:'',
            streams:{
                home_feed:['true'],
                search_feed:['dogs', 'cats']
            }
        }
    */
    
    app.get('/streams/save', function(req, res) {
		if (req.session.user){
			var id = req.param('id') || false;
            var data = req.param('data');
            saveStream(id, data);
		} else{
	       res.send(401);
		}
	});
    
    app.post('/canvas/save', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            canvases.findOne({id:req.param('id')}, function(e, o) {
                if(o){
                    o.public = false;
                    o.name = req.param('name');
                    canvases.save(o, {safe: true}, function(){
            
                        res.send(200);
                    });
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
	});
    
    app.post('/canvas/add/user', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            var email = req.param('email').toLowerCase();
            if(validateEmail(email) != false){
                canvases.findOne({id:req.param('id')}, function(e, o) {
                    if(o){
                        if(rank_check(req.session.user.user_status, o.members.length, 'canvasmembers') === true){                     
                            accounts.findOne({email:email}, function(e, x) {
                                if(x){
                                    if(o.members.indexOf(x.id) === -1){
                                        o.members[o.members.length] = x.id;
                                        o.member_emails[o.member_emails.length] = x.email;
                                        canvases.save(o, {safe: true}, function(){

                                            res.send({email:x.email, id:x.id});
                                        });
                                    } else {
                                       res.send('This user is already in your group'); 
                                    }
                                } else {
                                   res.send('This person does not have a HubYard account.'); 
                                }
                            });
                        } else {
                            res.send('Upgrade to add more members'); 
                        }
                    } else {
                        res.send(404);  
                    }   
                });
            } else {
                res.send('You did not enter a valid email');
            }
        } else {
            res.send(406);   
        }
	});
    
    app.post('/canvas/delete/user', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            accounts.findOne({id:req.param('user_id')}, function(e, x) {
                if(x){
                    canvases.findOne({id:req.param('id')}, function(e, o) {
                        if(o){
                            o.members.splice(o.members.indexOf(x.id), 1);
                            o.member_emails.splice(o.member_emails.indexOf(x.email), 1);
                            canvases.save(o, {safe: true}, function(){
                                
                                res.send(200);
                            });
                        } else {
                            res.send(404);   
                        }
                    });
                } else {
                    res.send(404);
                }   
            });
        } else {
            res.send(406);   
        }
	});
    
    app.post('/canvas/delete', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            accounts.findOne({id:req.session.user.id}, function(e, o) {
                if(o){
                    canvases.remove({id:req.param('id')}, function() {
                        o.options.canvas = 0;
                        accounts.save(o, {safe: true}, function(){
                            req.session.user = o;
                            res.send(200);
                        });
                    });
                } else {
                    res.send(404);   
                }
            });
            
        } else {
            res.send(406);   
        }
	});
    
     app.post('/canvas/new', function(req, res){
        if(req.session.user){
            canvases.find( { 'members' : req.session.user.id } ).toArray(function(e, x) {
                if(rank_check(req.session.user.user_status, x.length, 'canvas') === true){
                    var newData = {};
                    newData.public = false;
                    newData.name = req.param('name');
                    newData.members = [];
                    newData.member_emails = [];
                    newData.locations = [];
                    newData.streams = [];
                    newData.owner_id = req.session.user.id;
                    newData.creator = req.session.user.name;
                    newData.members[0] = req.session.user.id;
                    newData.member_emails[0] = req.session.user.email;
                    newData.id = crypto.randomBytes(5).toString('hex') + '_' + crypto.randomBytes(6).toString('hex') + '_' + crypto.randomBytes(8).toString('hex')  + '_' + crypto.randomBytes(26).toString('hex');
                    canvases.insert(newData, {safe: true}, function(err){
                        if(err){
                            res.send(400);
                        } else {
                            res.send(newData);
                        }
                    });
                } else {
                    res.send('nope');
                }
            });
        } else {
            res.send(406);   
        }
	});
    
    app.post('/canvas/switch', function(req, res){
        if(req.session.user){
            accounts.findOne({id:req.session.user.id}, function(e, o) {
                if(o){
                    o.options.canvas = req.param('id');
                    accounts.save(o, {safe: true}, function(){
                        req.session.user = o;
                        res.send(200);
                    });
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
	});
    
    
    //find a key
    
    /*
    function findIndexByKeyValue: finds "key" key inside "ob" object that equals "value" value
    example: findIndexByKeyValue(students, 'name', "Jim");
    object: students = [
       {name: 'John', age: 100, profession: 'Programmer'},
       {name: 'Jim', age: 50, profession: 'Carpenter'}
    ];
    would find the index of "Jim" and return 1
    */

    function findIndexByKeyValue(obj, key, value)
    {
        for (var i = 0; i < obj.length; i++) {
            if (obj[i][key] == value) {
                return i;
            }
        }
        return null;
    }

    
    //add a new stream to the canvas
    app.post('/stream/new', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            canvases.findOne({id:req.param('id')}, function(e, o) {
                if(o){
                    var position = o.streams.length;
                    var query = req.param('query') || null;
                    var id = crypto.randomBytes(2).toString('hex') + '_' + crypto.randomBytes(1).toString('hex')
                    var network_id = req.param('network_id');
                    o.locations[o.locations.length] = id; 
                    o.streams[position] = {service:req.param('service'), appearance:'default', filter:[], type:req.param('type'), query:query, id:id, user:req.param('user'), network_id:network_id}
                    
                    if(req.param('network_id') === 'RSS'){
                        
                        accounts.findOne({id:req.session.user.id}, function(e, x) {
                            if(x){
                                if(x.rss_feeds){
                                    x.rss_feeds = x.rss_feeds + 1;
                                } else {
                                    x.rss_feeds = 1;
                                }
                                if(rank_check(req.session.user.user_status, x.rss_feeds, 'RSS') === true){ 
                                    canvases.save(o, {safe: true}, function(){
                                        accounts.save(x, {safe: true}, function(){
                                            req.session.user = x;
                                            res.send(200);
                                        });
                                    });
                                } else {
                                    res.send('nope');
                                }
                            } else {
                                res.send(404);   
                            }
                        });
                        
                    } else {
                        
                        canvases.save(o, {safe: true}, function(){
                            res.send(200);
                        });
                        
                    }
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
    });

    //saves positions
    app.post('/stream/saveposition', function(req, res){
       
        if(req.session.user !== undefined && req.param('id') !== undefined && req.param('ids') !== undefined){
            
            canvases.findOne({id:req.param('id')}, function(e, o) {
                if(o){
                    o.locations = req.param('ids').split(','); 
                    canvases.save(o, {safe: true}, function(){
                    
                        res.send(200);
                    });
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
    });
    
    //change appearance
    app.post('/stream/appearance', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            canvases.findOne({id:req.param('id')}, function(e, o) {
                if(o){
                    var id = req.param('stream_id');
                    o.streams[findIndexByKeyValue(o.streams, 'id', id)].appearance = req.param('change');
                    canvases.save(o, {safe: true}, function(){
                    
                        res.send(200);
                    });
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
    });
    
    //remove a new stream from the canvas
    app.post('/stream/delete', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            canvases.findOne({id:req.param('id')}, function(e, o) {
                if(o){
                    var id = req.param('stream_id');
                    
                    o.locations.splice(o.locations.indexOf(id), 1);
                    o.streams.splice(findIndexByKeyValue(o.streams, 'id', id), 1);
                    
                    
                    if(req.param('service') === 'RSS'){
                        
                        accounts.findOne({id:req.session.user.id}, function(e, x) {
                            if(x){
                                if(x.rss_feeds){
                                    x.rss_feeds = x.rss_feeds - 1;
                                } else {
                                    x.rss_feeds = 0;
                                }
                                if(rank_check(req.session.user.user_status, x.rss_feeds, 'RSS') === true){ 
                                    canvases.save(o, {safe: true}, function(){
                                        accounts.save(x, {safe: true}, function(){
                                            req.session.user = x;
                                            res.send({id:req.param('stream_id')});
                                        });
                                    });
                                } else {
                                    res.send('nope');
                                }
                            } else {
                                res.send(404);   
                            }
                        });
                        
                    } else {
                        
                        canvases.save(o, {safe: true}, function(){
                            res.send({id:req.param('stream_id')});
                        });
                        
                    }
                } else {
                    res.send(404);   
                }
            });
        } else {
            res.send(406);   
        }
    });

    
    //collect posts
    app.post('/stream/collect', function(req, res){
        if(req.session.user){
            if(req.param('service') === 'RSS'){
                var query = req.param('query');
                var service = req.param('service');
                var link = 'http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&num=100&q=' + encodeURIComponent(query);
               
                generic_request(link, {}, 'GET', function(o){
                    
                    if(o.responseData){
                        res.send({data:o.responseData.feed, id:req.param('id'), service:service, network_id:req.param('network_id')});
                    } else {
                        console.log(o);
                        res.send(400);
                    }
                });
            } else {
                networks.findOne({id:req.param('network_id') }, function(e, o) {
                    if(o){
                        var authorization = {};
                        var query = req.param('query');
                        var type = req.param('type');
                        var service = req.param('service');
                        var pageation_id = req.param('pageation_id');
                        switch(service) {
                            case 'twitter': 

                                 authorization = {
                                    request_token_url:'https://api.twitter.com/oauth/request_token',
                                    access_token_url:'https://api.twitter.com/oauth/access_token',
                                    consumer_key:keys.twitterconsume,
                                    consumer_key_secret:keys.twitterconsume_secret,
                                    token:o.auth.token,
                                    token_secret:o.auth.token_secret
                                }
                                var link = '';

                                switch(type) {
                                    case 'home_feed': 
                                        if(pageation_id){
                                            link = 'https://api.twitter.com/1.1/statuses/home_timeline.json?max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.twitter.com/1.1/statuses/home_timeline.json';
                                        }
                                    break;
                                    case 'user_feed': 
                                        if(pageation_id){
                                            link = 'https://api.twitter.com/1.1/statuses/user_timeline.json?max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.twitter.com/1.1/statuses/user_timeline.json';
                                        }
                                    break;
                                    case 'mentions_feed': 
                                        if(pageation_id){
                                            link = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json?max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.twitter.com/1.1/statuses/mentions_timeline.json';
                                        }
                                    break;
                                    case 'search_feed': 
                                        if(pageation_id){
                                            link = 'https://api.twitter.com/1.1/search/tweets.json?q=' + query + '&max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.twitter.com/1.1/search/tweets.json?q=' + query ;

                                        }
                                    break;
                                    case 'user_search_feed': 
                                        if(pageation_id){
                                            link = 'https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=' + query + '&max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=' + query ;

                                        }
                                    break;
                                }

                                oauth_1_request(link, authorization, 'get', function(results){

                                    res.send({data:results, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                });

                                break;
                            case 'tumblr': 
                                 authorization = {
                                    request_token_url:'http://www.tumblr.com/oauth/request_token',
                                    access_token_url:'http://www.tumblr.com/oauth/access_token',
                                    consumer_key:keys.tumblrconsume,
                                    consumer_key_secret:keys.tumblrconsume_secret,
                                    token:o.auth.token,
                                    token_secret:o.auth.token_secret
                                }

                                var link = '';

                                switch(type) {
                                    case 'home_feed': 
                                        if(pageation_id){
                                            link = 'http://api.tumblr.com/v2/user/dashboard?notes_info=true&offset=' + pageation_id;
                                        } else {
                                            link = 'http://api.tumblr.com/v2/user/dashboard?notes_info=true';
                                        }
                                    break;
                                    case 'user_feed': 
                                        if(pageation_id){
                                            link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/posts?&offset=' + pageation_id;
                                        } else {
                                            link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/posts?api_key=' + keys.tumblrconsume;
                                        }
                                    break;
                                    case 'user_search_feed': 
                                        if(pageation_id){
                                            link = 'http://api.tumblr.com/v2/blog/' + query + '.tumblr.com/posts/queue?notes_info=true&offset=' + pageation_id;
                                        } else {
                                            link = 'http://api.tumblr.com/v2/blog/' + query + '.tumblr.com/posts/queue?api_key=' + keys.tumblrconsume;

                                        }
                                    break;
                                    case 'search_feed': 
                                        if(pageation_id){
                                           link = 'http://api.tumblr.com/v2/tagged?tag=' + query + '&before=' + pageation_id;
                                        } else {
                                           link = 'http://api.tumblr.com/v2/tagged?tag=' + query +'?api_key=' + keys.tumblrconsume;
                                        }
                                    break;
                                }
                                console.log(link)
                                oauth_1_request(link, authorization, 'get', function(results){

                                    res.send({data:results, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                });

                                break;
                            case 'instagram': 
                                 auth = 'access_token=' + o.auth.token;
                                var link = '';

                                switch(type) {
                                    case 'home_feed': 
                                        if(pageation_id){
                                            link = 'https://api.instagram.com/v1/users/self/feed?' + auth + '&max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.instagram.com/v1/users/self/feed?' + auth;
                                        }
                                    break;
                                    case 'user_feed': 
                                        if(pageation_id){
                                            link = 'https://api.instagram.com/v1/users/self/media/recent?' + auth + '&max_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.instagram.com/v1/users/self/media/recent?' + auth;
                                        }
                                    break;
                                    case 'search_feed': 
                                        if(pageation_id){
                                            link = 'https://api.instagram.com/v1/tags/' + query + '/media/recent?' + auth + '&max_tag_id=' + pageation_id;
                                        } else {
                                            link = 'https://api.instagram.com/v1/tags/' + query + '/media/recent?' + auth ;

                                        }
                                    break;
                                    case 'user_search_feed':
                                        generic_request('https://api.instagram.com/v1/users/search?' + auth +'&q=' + query, {}, 'GET', function(o){
                                            o = o.data[0];
                                            if(pageation_id){
                                                link = 'https://api.instagram.com/v1/users/' + o.id + '/media/recent?' + auth + '&max_id=' + pageation_id;
                                            } else {
                                                link = 'https://api.instagram.com/v1/users/' + o.id + '/media/recent?' + auth ;
                                            }
                                            generic_request(link, {}, 'GET', function(o){
                                                res.send({data:o.data, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                            });
                                        });

                                    break;
                                }

                                if(type !== 'user_search_feed'){
                                    generic_request(link, {}, 'GET', function(o){
                                        res.send({data:o.data, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                    });
                                }
                                break;
                            case 'product hunt': 
                                var link = '';
                                var header = {Authorization:'Bearer ' + o.auth.token};
                                switch(type) {
                                    case 'hunt_feed': 
                                        if(pageation_id){
                                            link = 'https://api.producthunt.com/v1/posts?days_ago=' + pageation_id;
                                        } else {
                                            link = 'https://api.producthunt.com/v1/posts'
                                        }
                                    break;
                                }

                                generic_request(link, header, 'GET', function(o){
                                    res.send({data:o, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                });
                                break;   
                            case 'facebook page': 
                                var link = '';
                                var header = o.auth.token;
                                switch(type) {
                                    case 'page_posts': 
                                        if(pageation_id){
                                            link = pageation_id ;
                                        } else {
                                            link = 'https://graph.facebook.com/v2.2/' + o.user.id + '/posts?access_token=' + header
                                        }
                                    break;
                                    case 'page_mentions': 
                                        if(pageation_id){
                                            link = pageation_id ;
                                        } else {
                                            link = 'https://graph.facebook.com/v2.2/' + o.user.id + '/tagged?access_token=' + header
                                        }
                                    break;    
                                }
                                generic_request(link, {}, 'GET', function(o){
                                    res.send({data:o, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                });
                                break;  
                            case 'dribbble': 
                                var link = '';
                                var header = {Authorization:'Bearer ' + o.auth.token};
                                switch(type) {
                                    case 'all_shots': 
                                        if(pageation_id){


                                            link = 'https://api.dribbble.com/v1/shots?date=' + pageation_id ;

                                        } else {
                                            link = 'https://api.dribbble.com/v1/shots'
                                        }
                                    break;
                                }

                                generic_request(link, header, 'GET', function(o){
                                    res.send({data:o, id:req.param('id'), service:service, network_id:req.param('network_id')});
                                });
                                break;   
                        }

                    } else {
                        res.send(404);   
                    }
                })
            }
        } else {
            res.send(406);   
        }
    });
    
    
    
    
    //get details
    app.post('/post/details', function(req, res){
        if(req.session.user){
            networks.findOne({id:req.param('network_id') }, function(e, o) {
                if(o){
                    var authorization = {};
                    var id = req.param('user_id');
                    var type = req.param('type');
                    var service = o.service;
                    
                    switch(service) {
                        case 'twitter': 
                            
                             authorization = {
                                request_token_url:'https://api.twitter.com/oauth/request_token',
                                access_token_url:'https://api.twitter.com/oauth/access_token',
                                consumer_key:keys.twitterconsume,
                                consumer_key_secret:keys.twitterconsume_secret,
                                token:o.auth.token,
                                token_secret:o.auth.token_secret
                            }
                            var link = '';
                            switch(type) {
                                case 'user': 
                                    link = 'https://api.twitter.com/1.1/users/show.json?user_id=' + id;
                                break;
                            }
                            oauth_1_request(link, authorization, 'get', function(results){
                                res.send({service:service, data:results});
                            });
                            
                            break;
                        case 'instagram':
                            auth = 'access_token=' + o.auth.token;
                            var link = '';
                            switch(type) {
                                case 'user': 
                                    link = 'https://api.instagram.com/v1/users/' + id + '?' + auth;
                                    retype = 'user';
                                break;
                            }
                            generic_request(link, {}, 'GET', function(results){
                                res.send({service:service, data:results.data});
                            });
                            break;
                        case 'product hunt':
                            var link = '';
                            var header = {Authorization:'Bearer ' + o.auth.token};
                            switch(type) {
                                case 'user': 
                                    link = 'https://api.producthunt.com/v1/users/' + id;
                                    retype = 'user';
                                break;
                            }
                            generic_request(link, header, 'GET', function(results){
                                res.send({service:service, data:results.user});
                            });
                            break;
                        case 'dribbble':
                            var link = '';
                            var header = {Authorization:'Bearer ' + o.auth.token};

                            switch(type) {
                                case 'user': 
                                    link = 'https://api.dribbble.com/v1/users/' + id;
                                    retype = 'user';
                                break;
                            }
                            generic_request(link, header, 'GET', function(results){
                                res.send({service:service, data:results});
                            });
                            break;
                    }
                    
                } else {
                    res.send(404);   
                }
            })
        } else {
            res.send(406);   
        }
    });
    
    
    //perform an action
    app.post('/post/action', function(req, res){
        if(req.session.user){
            networks.findOne({id:req.param('network_id') }, function(e, o) {
                if(o){
                    var authorization = {};
                    var id = req.param('post_id');
                    var id_m = req.param('post_id_additional');
                    var type = req.param('type');
                    var text = req.param('text');
                    var service = o.service;
                    
                    switch(service) {
                        case 'twitter': 
                            
                             authorization = {
                                request_token_url:'https://api.twitter.com/oauth/request_token',
                                access_token_url:'https://api.twitter.com/oauth/access_token',
                                consumer_key:keys.twitterconsume,
                                consumer_key_secret:keys.twitterconsume_secret,
                                token:o.auth.token,
                                token_secret:o.auth.token_secret
                            }
                            var link = '';
                            var retype = '';
                            switch(type) {
                                case 'heart': 
                                    link = 'https://api.twitter.com/1.1/favorites/create.json?id=' + id;
                                    retype = 'unheart';
                                break;
                                case 'unheart': 
                                    link = 'https://api.twitter.com/1.1/favorites/destroy.json?id=' + id;
                                    retype = 'heart';
                                break;
                                case 'retweet': 
                                    link = 'https://api.twitter.com/1.1/statuses/retweet/' + id + '.json';
                                    retype = 'retweet';
                                break;
                                case 'comment': 
                                    link = 'https://api.twitter.com/1.1/statuses/update.json?in_reply_to_status_id=' + id + '&status=' + encodeURIComponent(text);
                                    retype = 'comment';
                                break;
                            }

                            oauth_1_request(link, authorization, 'post', function(results){
                                res.send({type:retype});
                            });
                            
                            break;
                        case 'tumblr': 
                            
                             authorization = {
                                request_token_url:'http://www.tumblr.com/oauth/request_token',
                                access_token_url:'http://www.tumblr.com/oauth/access_token',
                                consumer_key:keys.tumblrconsume,
                                consumer_key_secret:keys.tumblrconsume_secret,
                                token:o.auth.token,
                                token_secret:o.auth.token_secret
                            }
                            var link = '';
                            var retype = '';
                            var body = {};
                            switch(type) {
                                case 'heart': 
                                    link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/user/like';
                                    body = {id:id, reblog_key:id_m}
                                    retype = 'unheart';
                                break;
                                case 'unheart': 
                                    link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/user/unlike';
                                    body = {id:id, reblog_key:id_m}
                                    retype = 'unheart';
                                break;
                                case 'retweet': 
                                    link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/post/reblog';
                                    retype = 'retweet';
                                    body = {id:id, reblog_key:id_m}
                                break;
                                case 'back-in-time': 
                                    link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/post/reblog';
                                    retype = 'retweet';
                                    body = {id:id, reblog_key:id_m, state:'queue'}
                                break;
                                case 'comment': 
                                    link = 'http://api.tumblr.com/v2/blog/' + o.user.username + '.tumblr.com/post/reblog';
                                    retype = 'retweet';
                                    body = {id:id, reblog_key:id_m, comment:comment}
                                break;
                            }
                            console.log(link)
                            oauth_1_request(link, authorization, 'post', function(results){
                                res.send({type:retype});
                            }, body);
                            
                            break;
                        case 'instagram':
                            auth = 'access_token=' + o.auth.token;
                            var method = 'POST'
                            switch(type) {
                                case 'heart': 
                                    link = 'https://api.instagram.com/v1/media/' + id + '/likes?' + auth;
                                    retype = 'unheart';
                                    method = 'POST'
                                break;
                                case 'unheart': 
                                    link = 'https://api.instagram.com/v1/media/' + id + '/likes?' + auth;
                                    retype = 'heart';
                                    method = 'DELETE'
                                break;
                            }
                            generic_request(link, {}, method, function(o){
                                res.send({type:retype});
                            });
                            break;
                        case 'facebook page':
                            auth = 'access_token=' + o.auth.token;
                            var method = 'POST'
                            switch(type) {
                                case 'heart': 
                                    link = 'https://graph.facebook.com/v2.2/' + id + '/likes?' + auth;
                                    retype = 'unheart';
                                    method = 'POST'
                                break;
                                case 'unheart': 
                                    link = 'https://graph.facebook.com/v2.2/' + id + '/likes?' + auth;
                                    retype = 'heart';
                                    method = 'DELETE'
                                break;
                                case 'comment': 
                                    link = 'https://graph.facebook.com/v2.2/' + id + '/comments?' + auth + '&message=' + encodeURIComponent(text) ;
                                    retype = 'comment';
                                    method = 'POST'
                                break;
                            }
                            generic_request(link, {}, method, function(o){
                                res.send({type:retype});
                            });
                            break;
                        case 'dribbble':
                            var header = {Authorization:'Bearer ' + o.auth.token};
                            var link = '';
                            var method = 'POST'
                            var retype = '';
                            switch(type) {
                                case 'heart': 
                                    link = 'https://api.dribbble.com/v1/shots/' + id + '/like';
                                    retype = 'unheart';
                                break;
                                case 'unheart': 
                                    link = 'https://api.dribbble.com/v1/shots/' + id + '/like';
                                    retype = 'heart';
                                    method = 'DELETE'
                                break;
                            }
                            generic_request(link, header, method, function(o){
                                res.send({type:retype});
                            });
                            break;
                    }
                    
                } else {
                    res.send(404);   
                }
            })
        } else {
            res.send(406);   
        }
    });
    
     app.post('/network/delete', function(req, res){
        if(req.session.user !== undefined && req.param('id') !== undefined){
            networks.remove({id:req.param('id')}, function() {
                res.send(200);
            });
        } else {
            res.send(406);   
        }
	});
    
    var saveNetwork = function(req, res, id, auth, user, service){
        networks.findOne({member_id:req.session.user.id, user:user, service:service }, function(e, o) {
            if(o){
                o.auth = auth; //{token:,token_secret:}
                o.user = user; //{name:'joe', profile_pic:'joe', username:'joe90'}
                o.service = service; //twitter
                networks.save(o, {safe: true}, function(){
                    res.redirect('/app');
                });
            } else {
                networks.find( { 'member_id' : req.session.user.id } ).toArray(function(e, x) {
                    if(rank_check(req.session.user.user_status, x.length, 'network') === true){
                        var newData = {};
                        newData.auth = auth; //{token:,token_secret:}
                        newData.user = user; //{username:'joe'}
                        newData.service = service; //twitter
                        newData.member_id = req.session.user.id;
                        newData.id = crypto.randomBytes(2).toString('hex') + '_' + crypto.randomBytes(12).toString('hex') + '_' + crypto.randomBytes(5).toString('hex')  + '_' + crypto.randomBytes(4).toString('hex');
                        networks.insert(newData, {safe: true}, function(){
                            res.redirect('/app');
                        });
                    } else {
                        res.redirect('/app?upgrade=true');
                    }
                });
            }
        });
    }
    
    var oauth_1 = require('oauth');

    
    var oauth_1_request = function(url, headers, type, cb, post_body){
        var oauth = new oauth_1.OAuth(
          headers.request_token_url, //'https://api.twitter.com/oauth/request_token'
          headers.access_token_url, //'https://api.twitter.com/oauth/access_token'
          headers.consumer_key,
          headers.consumer_key_secret,
          '1.0A',
          null,
          headers.encoding || 'HMAC-SHA1'  //'HMAC-SHA1'
        );
        
        if(type === 'get'){
            oauth.get(
              url,
              headers.token, //test user token
              headers.token_secret, //test user secret            
              function (e, data, res){
                if (e){
                    console.log(e);
                    cb(e)
                } else {
                    var result = data;
                    
                    if(typeof body !== 'object'){
                        result = JSON.parse(data);
                    }
                    cb(result);
                };    
              });    
        } else if(type === 'post'){
            var post_body = post_body || null;
            oauth.post(
              url,
              headers.token, //test user token
              headers.token_secret, //test user secret  
              post_body,
              null,
              function (e, data, res){
                if (e){
                    console.log(e);
                    cb(400)
                } else {
                    var result = data;
                    if(typeof body !== 'object'){
                        result = JSON.parse(data);
                    }
                    cb(result);
                };    
              }); 
        }
    }
    
        var QueryStringToJSON = function(query) {            
            var pairs = query.split('&');

            var result = {};
            pairs.forEach(function(pair) {
                pair = pair.split('=');
                result[pair[0]] = decodeURIComponent(pair[1] || '');
            });

            return JSON.parse(JSON.stringify(result));
        }
    
    var request = require('request');
    
    var generic_request = function(url, headers, method, cb, bodey, jsoen, formData){
        var method = method;
		var options = {
			url: url,
			headers: headers,
			timeout: 20000,
            method:method.toUpperCase()
		};
        if(bodey){
            options.body = bodey;
        }
        if(jsoen){
            options.json = jsoen;
        }
        if(formData){
            options.formData = formData;
        }

		function callback(error, response, body) {
			if (!error && response.statusCode == 200) {
                var result = body;
                if(typeof body !== 'object' && body.indexOf('{') !== -1){
				    result = JSON.parse(body);
                } else if(typeof body !== 'object'){
                    result = QueryStringToJSON(body);
                }
				cb(result);
			} else {
               var result = error;
                console.log(body);
				cb(result);  
            }
		}
		request(options, callback);
	}

    //log twitter network

    
    var OAuth = require('oauth').OAuth
    , otw = new OAuth(
    "https://api.twitter.com/oauth/request_token",
    "https://api.twitter.com/oauth/access_token",
    keys.twitterconsume,
    keys.twitterconsume_secret,
    "1.0",
    keys.url_host + "/auth/twitter/callback",
    "HMAC-SHA1"
    );

    app.get('/auth/twitter', function(req, res) {
       if(req.session.user != undefined){
            otw.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
              req.session.auth = {
                token: oauth_token,
                token_secret: oauth_token_secret
              };
              res.redirect('https://twitter.com/oauth/authenticate?oauth_token='+oauth_token)
            });
        } else {
            res.redirect('/');
        }
    });

    app.get('/auth/twitter/callback', function(req, res) {
      if (req.session.auth) {
        req.session.auth.verifier = req.query.oauth_verifier;
        var oauth_data = req.session.auth;

        otw.getOAuthAccessToken(
          oauth_data.token,
          oauth_data.token_secret,
          oauth_data.verifier,
          function(error, oauth_access_token, oauth_access_token_secret, results) {
            if (error) {
              res.send("Authentication Failure!");
            } else {
                var auth = {token:oauth_access_token, token_secret: oauth_access_token_secret}
                
                    
                var oth = {
                    request_token_url:'https://api.twitter.com/oauth/request_token',
                    access_token_url:'https://api.twitter.com/oauth/access_token',
                    consumer_key:keys.twitterconsume,
                    consumer_key_secret:keys.twitterconsume_secret,
                    token:auth.token,
                    token_secret:auth.token_secret
                }
                
                oauth_1_request('https://api.twitter.com/1.1/account/settings.json', oth, 'get', function(o){
                    oauth_1_request('https://api.twitter.com/1.1/users/show.json?screen_name=' + o.screen_name, oth, 'get', function(results){
                        var service = 'twitter';
                        var user = {name:results.name, picture:results.profile_image_url, username:results.screen_name, id:results.id_str}

                        saveNetwork(req, res, null, auth, user, service);
                    });
                });
            }
          });
      } else {
        res.redirect('/app'); // Redirect to login page
      }
    });
    
    //save tumblr credentials
    var OAuth = require('oauth').OAuth
    , ott = new OAuth(
        "http://www.tumblr.com/oauth/request_token",
        "http://www.tumblr.com/oauth/access_token",
        keys.tumblrconsume,
        keys.tumblrconsume_secret,
        "1.0",
        keys.url_host + "/auth/tumblr/callback",
        "HMAC-SHA1"
      );

    // tumblr


    app.get('/auth/tumblr', function(req, res) {
        if (req.session.user == null){
            // if user is not logged-in redirect back to login page //
                    res.redirect('/');
        }   else {
              ott.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
                if (error) {
                  console.log(error);
                  res.send("Authentication Failed!");
                }
                else {
                  req.session.auth = {
                    token: oauth_token,
                    token_secret: oauth_token_secret
                  };
                  req.session.use = false;
                  res.redirect('http://www.tumblr.com/oauth/authorize?oauth_token='+oauth_token)
                }
              });

          };
        });

    app.get('/auth/tumblr/callback', function(req, res) {
        if (req.session.user == null ){
            // if user is not logged-in redirect back to login page //
                    res.redirect('/');
        }   else{
          if (req.session.auth !== undefined && req.session.use !== true ) {
            req.session.use = true;
            req.session.auth.verifier = req.query.oauth_verifier;
            var oauth_data = req.session.auth;

            ott.getOAuthAccessToken(
              oauth_data.token,
              oauth_data.token_secret,
              oauth_data.verifier,
              function(error, oauth_access_token, oauth_access_token_secret, results) {
                if (error) {
                  console.log(error);
                  res.redirect("/app");
                } else {

                    var auth = {token:oauth_access_token, token_secret: oauth_access_token_secret}
                    var oth = {
                        request_token_url:'http://www.tumblr.com/oauth/request_token',
                        access_token_url:'http://www.tumblr.com/oauth/access_token',
                        consumer_key:keys.tumblrconsume,
                        consumer_key_secret:keys.tumblrconsume_secret,
                        token:auth.token,
                        token_secret:auth.token_secret
                    }
                    req.session.auth = auth;
                    oauth_1_request('http://api.tumblr.com/v2/user/info', oth, 'get', function(o){
                        
                        if(o.response.user.blogs){
          
                            res.render('select_account', {auth: auth, blogs:o.response.user.blogs});
                        } else {
                            res.redirect("/app");        
                        }
                    });

                }
              }
            );

          }
          else {
            res.redirect('/app'); // Redirect to login page
          }
        };
    });
    
    
    app.get('/auth/tumblr/return', function(req, res) {
        if(req.session.user !== undefined && req.session.auth !== undefined){
            
            var auth = req.session.auth;
            var name = req.param('name');
            var username = req.param('username');
            var oth = {
                request_token_url:'http://www.tumblr.com/oauth/request_token',
                access_token_url:'http://www.tumblr.com/oauth/access_token',
                consumer_key:keys.tumblrconsume,
                consumer_key_secret:keys.tumblrconsume_secret,
                token:auth.token,
                token_secret:auth.token_secret
            }
            var service = 'tumblr';
            var user = {name:name , picture:('http://api.tumblr.com/v2/blog/' + username +'.tumblr.com/avatar'), username:username, id:username}
            saveNetwork(req, res, null, auth, user, service);
        } else {
            res.send(404);   
        }
    });
    
    
    //save instagram credentials - please replace with something better


    var instaauth = {
        token: keys.instagramconsume,
        redirect_uri: keys.url_host + '/auth/instagram/callback',
        response: 'code',
        scope: 'basic+likes+comments+relationships'
     }
    
    app.get('/auth/instagram', function(req, res) {
       if(req.session.user != undefined){
              res.redirect('https://api.instagram.com/oauth/authorize/?client_id=' + instaauth.token  + '&redirect_uri=' + instaauth.redirect_uri  + '&response_type=' + instaauth.response + '&scope=' + instaauth.scope)
        } else {
            res.redirect('/');
        }
    });
    
    
    app.get('/auth/instagram/callback', function(req, res) {
       if(req.param != undefined){
           
            var instaauth_2 = {
                  client_id : keys.instagramconsume,
                  client_secret : keys.instagramconsume_secret,
                  redirect_uri : instaauth.redirect_uri,
                  code : req.param('code'),
                  grant_type : "authorization_code"
            }
            
            if(instaauth_2.code){
                generic_request('https://api.instagram.com/oauth/access_token', {}, 'POST', function(o){
                    if(o && o.access_token){
                        var auth = {token:o.access_token};
                        generic_request('https://api.instagram.com/v1/users/self?access_token=' + auth.token, {}, 'GET', function(o){
                            var service = 'instagram';
                            o = o.data;
                            var user = {name:o.full_name, picture:o.profile_picture, username:o.username, id:o.id}
                            saveNetwork(req, res, null, auth, user, service);
                        });
                    } else {
                        res.send(400);   
                    }
                }, null, null, instaauth_2);
            } else {
                res.redirect('/');
            }
        } else {
            res.redirect('/');
        }
    });
    
    //login 2 facebook
    
    var fbauth = {
        token: keys.facebookconsume,
        redirect_uri: keys.url_host + '/auth/facebook/callback',
        response: 'code',
        scope: 'publish_actions, manage_pages, read_page_mailboxes'
     }
    
    app.get('/auth/facebook', function(req, res) {
       if(req.session.user != undefined){
              req.session.use = false;
              res.redirect('https://www.facebook.com/dialog/oauth?client_id=' + fbauth.token  + '&redirect_uri=' + fbauth.redirect_uri  + '&response_type=' + fbauth.response + '&scope=' + fbauth.scope)
       
        } else {
            res.redirect('/');
        }
    });

    app.get('/auth/facebook/callback', function(req, res) {
     
       if(req.param != undefined && req.session.user !== undefined && req.session.use !== true){
           req.session.use = true;
            var fbauth_2 = {
                  client_id : keys.facebookconsume,
                  client_secret : keys.facebookconsume_secret,
                  redirect_uri : fbauth.redirect_uri,
                  code : req.param('code'),
                  grant_type : "authorization_code"
            }
            
            generic_request('https://graph.facebook.com/oauth/access_token?client_id=' + fbauth_2.client_id + '&redirect_uri=' + fbauth_2.redirect_uri + '&client_secret=' + fbauth_2.client_secret + '&code=' + fbauth_2.code + '', {}, 'POST', function(o){
                if(o && o.access_token){
                    var auth = {token:o.access_token};
                    req.session.auth = auth;
                    generic_request('https://graph.facebook.com/v2.2/me/accounts?access_token=' + auth.token, {}, 'GET', function(o){
                        pages = o;

                        res.render('select_account', {auth: auth, pages:pages});
                    });
                } else {
                    res.send(400);   
                }
            });
        } else {
            res.redirect('/');
        }
    });
    
    app.get('/auth/facebook/return', function(req, res) {
        if(req.session.user !== undefined && req.session.auth !== undefined){
            var auth = {token:req.param('auth'), token_normal:req.session.auth}; 
            var name = req.param('name');
            var username = req.param('id');
            var service = 'facebook page';
            var user = {name:name , picture:('https://graph.facebook.com/v2.2/' + username + '/picture'), username:name, id:username}
            saveNetwork(req, res, null, auth, user, service);
        } else {
            res.send(404);   
        }
    });
    
    //login 2 producthunt
    
    var phauth = {
        token: keys.producthuntconsume,
        redirect_uri: keys.url_host + '/auth/producthunt/callback',
        response: 'code',
        scope: 'public+private'
     }
    
    app.get('/auth/producthunt', function(req, res) {
       if(req.session.user != undefined){
             
              res.redirect('https://api.producthunt.com/v1/oauth/authorize?client_id=' + phauth.token  + '&redirect_uri=' + phauth.redirect_uri  + '&response_type=' + phauth.response + '&scope=' + phauth.scope)
       
        } else {
            res.redirect('/');
        }
    });

    app.get('/auth/producthunt/callback', function(req, res) {
       if(req.param != undefined){
           
            var phauth_2 = {
                  client_id : keys.producthuntconsume,
                  client_secret : keys.producthuntconsume_secret,
                  redirect_uri : phauth.redirect_uri,
                  code : req.param('code'),
                  grant_type : "authorization_code"
            }

            generic_request('https://api.producthunt.com/v1/oauth/token', {}, 'POST', function(o){
                if(o && o.access_token){
                    var auth = {token:o.access_token};
                    generic_request('https://api.producthunt.com/v1/me', {Authorization: 'Bearer ' + auth.token}, 'GET', function(o){
                        var service = 'product hunt';
                        o = o.user;
                        var user = {name:o.name, picture:o.image_url.original, username:o.username, id:o.id}
                        saveNetwork(req, res, null, auth, user, service);
                    });
                } else {
                    res.send(400);   
                }
            }, phauth_2, true);
        } else {
            res.redirect('/');
        }
    });
    
    //login 2 dribble
    
    var dribbleauth = {
        token: keys.dribbleconsume,
        redirect_uri: keys.url_host + '/auth/dribbble/callback',
        scope: 'public+write+comment'
     }
    
    app.get('/auth/dribbble', function(req, res) {
       if(req.session.user != undefined){
             
              res.redirect('https://dribbble.com/oauth/authorize?client_id=' + dribbleauth.token  + '&redirect_uri=' + dribbleauth.redirect_uri  + '&scope=' + dribbleauth.scope + '&state=' + crypto.randomBytes(6).toString('hex'))
       
        } else {
            res.redirect('/');
        }
    });

    app.get('/auth/dribbble/callback', function(req, res) {
       if(req.param != undefined){
           
            var phauth_2 = {
                  client_id : keys.dribbleconsume,
                  client_secret : keys.dribbleconsume_secret,
                  redirect_uri: dribbleauth.redirect_uri,
                  code : req.param('code'),
            }

            generic_request('https://dribbble.com/oauth/token', {}, 'POST', function(o){
            if(o && o.access_token){
                var auth = {token:o.access_token};
                    generic_request('https://api.dribbble.com/v1/user', {Authorization: 'Bearer ' + auth.token}, 'GET', function(o){
                        var service = 'dribbble';
                        var user = {name:o.name, picture:o.avatar_url, username:o.username, id:o.id}
                        saveNetwork(req, res, null, auth, user, service);
                    });
                } else {
                    res.send(400);   
                }
            }, phauth_2, true);
        } else {
            res.redirect('/');
        }
    });
    
    //payments - Stripe
    var stripe = require("stripe")(
      keys.stripe
    );
    
    var order = function(req, res){
        var type = req.param('type');
        if(req.session.user.payment.id){
           if(type === 'enthusiast'){
                if(req.session.user.payment.subscription){
                    accounts.findOne({id:req.session.user.id}, function(e, o) {
                        if(o){
                            stripe.customers.cancelSubscription(
                              o.payment.id,
                              o.payment.subscription,
                              function(err, confirmation) {
                                if(err){
                                    o.payment.subscription = undefined;
                                    o.user_status = type;
                                    canvases.remove({owner_id:req.session.user.id}, function() {
                                        networks.remove({member_id:req.session.user.id}, function() {
                                            accounts.save(o, {safe: true}, function(){
                                                req.session.user = o;
                                                res.send(200);
                                            });
                                        });
                                    });
                                } else {
                                    o.payment.id = confirmation.customer;
                                    o.payment.subscription = undefined;
                                    o.user_status = type;
                                    canvases.remove({owner_id:req.session.user.id}, function() {
                                        networks.remove({member_id:req.session.user.id}, function() {
                                            accounts.save(o, {safe: true}, function(){
                                                req.session.user = o;
                                                res.send(200);
                                            });
                                        });
                                    });
                                    
                                }
                              }
                            );
                        } else {
                            res.send(404);   
                        }
                    });
                } else {
                    res.send(200);   
                }
           } else {
               accounts.findOne({id:req.session.user.id}, function(e, o) {
                   if(o){
                       if(o.payment.subscription) {
                           stripe.customers.updateSubscription(
                              o.payment.id,
                              o.payment.subscription,
                              { plan: type },
                              function(err, subscription) {
                                if(err){
                                    console.log(err);
                                    res.send(400);
                                } else {
                                    o.user_status = type;
                                    o.payment.subscription = subscription.id;
                                    accounts.save(o, {safe: true}, function(err) {	
                                        if(err){
                                            res.send(400);
                                        } else {
                                            req.session.user = o
                                            res.send(200);
                                        }
                                    });	
                                }
                              }
                            );
                       } else {
                           stripe.customers.createSubscription(
                              o.payment.id,
                              {plan: type, card: req.param('card')},
                              function(err, subscription) {
                                if(err){
                                    console.log(err);
                                    res.send(400);
                                } else {
                                    o.user_status = type;
                                    o.payment.subscription = subscription.id;
                                    accounts.save(o, {safe: true}, function(err) {	
                                        if(err){
                                            res.send(400);
                                        } else {
                                            req.session.user = o
                                            res.send(200);
                                        }
                                    });	
                                }
                              }
                            );
                       }
                    } else {
                        res.send(404);   
                    }
               });
           }
        } else {
            res.send(406);   
        }    
    }
    
    
    
    app.post('/card', function(req,res){
        accounts.findOne({id:req.session.user.id}, function(e, o) {
            if(o){
                  if(o.payment.id){
                      if(o.payment.default_card){
                          stripe.customers.deleteCard(
                              o.payment.id,
                              o.payment.default_card,
                              function(err, confirmation) {
                                if(err){
                                    res.send(400);
                                } else {
                                    stripe.customers.createCard(
                                      o.payment.id,
                                      {card: req.param('card')},
                                      function(err, card) {
                                        if(err){
                                            res.send(400);
                                        } else {
                                            o.payment.default_card = card.default_card;
                                            o.payment.last4oncard = req.param('last4oncard');
                                            accounts.save(o, {safe: true}, function(err) {	
                                                if(err){
                                                    res.send(400);
                                                } else {
                                                    req.session.user = o
                                                    res.send(200);
                                                }
                                            });	
                                        }
                                      }
                                    );
                                }
                              }
                            );
                      } else {
                          stripe.customers.createCard(
                              o.payment.id,
                              {card: req.param('card')},
                              function(err, card) {
                                if(err){
                                    console.log(err);
                                    res.send(400);
                                } else {
                                    o.payment.default_card = card.id;
                                    o.payment.last4oncard = req.param('last4oncard');
                                    accounts.save(o, {safe: true}, function(err) {	
                                        if(err){
                                            res.send(400);
                                        } else {
                                            req.session.user = o
                                            res.send(200);
                                        }
                                    });	
                                }
                              }
                            );
                      }
                  } else {
                      stripe.customers.create({
                          email: o.email,
                          card: req.param('card')
                        }, function(err, customer) {
                            if(err){
                                console.log(err);
                                res.send(400);
                            } else {
                                    o.payment.id = customer.id;
                                    o.payment.default_card = customer.default_card;
                                    o.payment.last4oncard = req.param('last4oncard');
                                    accounts.save(o, {safe: true}, function(err) {	
                                        if(err){
                                            res.send(400);
                                        } else {
                                            order(req, res);
                                        }
                                    });	
                            }
                        }); 
                  }
            } else {
                res.send(404);   
            }
        });
    })
    
    app.post('/order', function(req, res){
        order(req, res);
    });
    
    //password reset

	app.post('/lost-password', function(req, res){
	// look up the user's account via their email
        
        if(typeof req.param('email') === 'string'){
        var email = req.param('email');
           
		accounts.findOne({email:email.toLowerCase()}, function(e, o){
			if (o){
				res.send('ok', 200);
				dispatchResetPasswordLink(o, function(e, m){
				// this callback takes a moment to return
					console.log(e);
				});
			}	else{
				res.send('email-not-found', 400);
			}
		});
        } else {
            res.send(400);
        }
	});
	
     
    app.post('/delete/account', function(req, res) {
		if(req.session.user){
            accounts.remove({id:req.session.user.id}, function(){
                req.session.destroy()
                res.send(200);
            });
        }
	});
    
	app.get('/reset-password', function(req, res) {
		var email = req.query["e"];
		var passH = req.query["p"];
		accounts.find({ $and: [{email:email.toLowerCase(), pass:passH}] }, function(e, o){
			if (o){
				req.session.reset = { email:email, passHash:passH };
				res.render('reset');
			} else{
	           // save the user's email in a session instead of sending to the client //
				res.redirect('/');
			}
		})
	});
	
	app.post('/reset-password', function(req, res) {
        if(typeof req.param('pass') === 'string'){
            var pass = req.param('pass');
        // retrieve the user's email from the session to lookup their account and reset password //
            var email = req.session.reset.email;
        // destory the session immediately after retrieving the stored email //
            req.session.destroy();
            accounts.findOne({email:email}, function(e, o){
                if (e){
                    res.send('unable to update password', 400);
                }	else{
                    saltAndHash(pass, function(hash){
                        o.pass = hash;
                        accounts.save(o, {safe: true}, function(err) {	
                            if(err){
                                res.send(400);
                            } else {
                                res.send(200)
                            }
                        });	
                    });
                }
            });
        }
	});
    
    var server = require("emailjs/email").server.connect({

        host 	    : keys.email.host,
        user 	    : keys.email.user,
        password    : keys.email.password,
        ssl		    : true

    });

    var dispatchResetPasswordLink = function(account, callback)
    {
        server.send({
            from         : keys.email.sender,
            to           : account.email,
            subject      : 'Password Reset',
            text         : 'something went wrong... :(',
            attachment   : composeEmail(account)
        }, callback );
    }

    var composeEmail = function(o)
    {
        var link = keys.url_host + '/reset-password?e='+o.email+'&p='+o.pass;
        var html = "<html><body>";
            html += "Hi "+o.name+",<br><br>";
            html += "This email has been generated to inform you that your password can be reset.";
            html += "Your username is :: <b>"+o.email+"</b><br><br>";
            html += "<a href='"+link+"'>Please click here to reset your password</a><br><br>";
            html += "Cheers,<br>";
            html += "Shubham Naik, <a href='http://hubyard.com'>Hubyard</a><br><br>";
            html += "Please send any inquiries to <a href='contact@hubyard.com'>contact@hubyard.com</a><br><br>";
            html += "</body></html>";
        return  [{data:html, alternative:true}];
    }
    
     var welcometo = function(account, callback)
    {
        server.send({
            from         : keys.email.sender,
            to           : account.email,
            subject      : 'Welcome to HubYard!',
            text         : 'Hey!',
            attachment   : welcomeEmail(account)
        }, callback );
    }
    
    var welcomeEmail = function(o)
    {
        var html = "<html><body>";
            html += "Hi "+o.name+",<br><br>";
            html += "Welcome to HubYard, we hope you enjoy your stay. <br><br> Reply to this email if you have any questions!";
            html += "<br><br> By the way, your username is :: <b>"+o.email+"</b><br><br>";
            html += "Cheers,<br>";
            html += "Shubham Naik, <a href='http://hubyard.com'>Hubyard</a><br><br>";
            html += "Please send any inquiries to <a href='contact@hubyard.com'>contact@hubyard.com</a><br><br>";
            html += "</body></html>";
        return  [{data:html, alternative:true}];
    }
    


	
}