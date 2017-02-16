var 
	fs = require('fs'),
	express = require('express'),
	mailLib = require('./mailbox.js'),
	MailBox = mailLib.MailBox,
	crypto = require('crypto'),
	session = require('express-session'),
	redis = require('redis'),
	connectRedis = require('connect-redis'),
	busboy = require('connect-busboy'),
	app = express(),
	RedisStore = connectRedis(session);
//var access = fs.createWriteStream('/opt/app/mailer.log');
//process.stdout.write = process.stderr.write = access.write.bind(access);
var mail;

function load(mode,Port,secret,cb,staticPath){
	secret = secret || '087f8713-a4fc-8ee2-1237';
	var rclient = redis.createClient({host: "redis", port: 6379});
	rclient.on("error", function (err) {
		console.log("Error " + err);
	});
	rclient.on("ready", function () {
		app.use(busboy());
		staticPath = staticPath || '/opt/app/static';
		app.use('/'+mode,express.static(staticPath));
		app.use(session({
			store: new RedisStore({
				client : rclient, // optional 
				host: 'redis', // optional 
				port: 6379
			}),
			secret: secret
		}));
		app.listen(Port, function () {
			console.log('Production on port :'+Port);
			cb(mode,app,rclient);
		})
	});
}
function handle_action(req, res){
	var Body = {};
	var attachment = [];
	function finish(){
		Body['om'] = Body['om'] ? Body['om'].toLowerCase() : '';
		
		Body['delete_after_day'] = Body['delete_after_day'] || '7';
		var json;
		try{
			json = Body['data'] ? JSON.parse(Body['data']) : false;
			Body['user_id'] = json.sender.id;
		}catch(e){
			console.log('JSON.parse',e);
		}
		//body['data'] = body['data'];
		
		console.log('finish[Body]',json,Body);
		var handled = json;
		var response = {
			error : Body['$action$'] +'['+Body['om']+']'+ ',not supported'
		};
		if(handled){
			handled = false;
			switch(Body['$action$']){
				case 'message':
					if(Body['om']=='add'){
						handled = true;
						mail.MessageAdd(json,attachment,function(err,msg_id){
							res.send(JSON.stringify({
								error : err,
								msg_id  : msg_id
							}));
						});
					}
					else if(Body['om']=='move'){
						handled = true;
						mail.MessageMove(json,function(err,msg_id){
							res.send(JSON.stringify({
								error : err,
								msg_id  : msg_id
							}));
						});
					}
					else if(Body['om']=='read'){
						handled = true;
						mail.MessageGet(json,function(err,msg){
							res.send(JSON.stringify({
								error : err,
								msg  : msg
							}));
						});
					}
					else if(Body['om']=='delete'){
						handled = true;
						mail.MessageDelete(json,function(err){
							res.send(JSON.stringify({
								error : err
							}));
						});
					}						
					break;
				case 'user':
					if(Body['om']=='create'){
						handled = true;
						mail.BoxCreate(json,function(err){
							res.send(JSON.stringify({
								error : err
							}));
						});
					}
					else if(Body['om']=='list'){
						handled = true;
						mail.BoxList(json,function(err,list){
							console.log('BoxList[User]:',err,list);

							res.send(JSON.stringify({
								error : err,
								list  : list
							}));
						});
					}
					else if(Body['om']=='delete'){
						handled = true;
						mail.UserDelete(json,function(err){
							res.send(JSON.stringify({
								error : err
							}));
						});
					}
					break;
				case 'box':
					if(Body['om']=='count'){
						handled = true;
						mail.BoxCount(json,function(err,count){
							res.send(JSON.stringify({
								error : err,
								count : count
							}));
						});
					}						
					else if(Body['om']=='read'){
						handled = true;
						mail.BoxRead(json,function(list){
							res.send(JSON.stringify({
								list : list
							}));
						});
					}
					else if(Body['om']=='delete'){
						handled = true;
						mail.BoxDelete(json,function(err){
							res.send(JSON.stringify({
								error : err
							}));
						});
					}						
					break;
			}
		}
		if(!handled)
			res.send(JSON.stringify(response));
	}
	
	//hexdump -n 16 -v -e '/1 "%02X"' /dev/urandom
	var token = crypto.randomBytes(32).toString('hex');
	Body['$action$'] = req.params.action;
	Body['$token$'] = token;
	if (req.busboy) {
		req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			console.log('busboy[file]',fieldname);
			switch(mimetype){
				case "image/jpeg":
				case "image/png":
				case "image/gif":
				case "image/jpg":
					// not supported for now ,todo...
					var token = crypto.randomBytes(32).toString('hex');
					var e = filename.split('.');
					var value = token+'.'+e[e.length-1];
					var saveTo = mailLib.AttachmentPath+value;
					file.pipe(fs.createWriteStream(saveTo));
					Body[fieldname] = value;
					attachment.push({ name : filename,path : value 	});
					break;
				
			}
			file.resume();
		});
		
		req.busboy.on('field', function(key, value, keyTruncated, valueTruncated) {
			console.log('busboy[field]',key);
			Body[key] = value;
		});
		req.busboy.on('finish',finish);
		
		req.pipe(req.busboy);
	}else{
		finish();
	}
}
load('prod',8090,'08ee2773-4447-1fc8-a4f8',
	function(mode,app,rclient){
		app.use('/prod',express.static(__dirname+'/web/'));
		console.log('MailBox',mode,mailLib.AttachmentPath);
		mail = new MailBox(rclient);// one per web server! not per client
		// SAMPLES

		/*
		mail.BoxCreate({ // CREATE USER and hes Boxes
			sender : {
				id : 1,
				Box : ['Inbox','Sent','Readed']
			}
		},function(err){
			mail.BoxList({ // LIST USER Boxes
				sender : {
					id : 1
				}
			},function(err,list){
				
				console.log('BoxList',err,list);
				
				mail.MessageAdd({// Send Message from SrcBox.box to DestUser.box
					sender : {
						id : 1,
						Box : 'Sent',
						name : 'Dima',
						Subject : 'Subject - 124',
						Msg : 'check'
					},
					receiver : {
						id : 2,
						Box : 'Inbox',
						name : 'Test'
					}				
				},function(err,sent){
					
					mail.MessageMove({ // Move User message from BoxA to BoxB
						sender : {
							id : 2,
							Box : 'Inbox',
							BoxNew : 'Readed',
							msg_id : sent
						}
					},function(err,msg_sent_id){
						mail.MessageGet({
							sender : {
								id : 2,
								Box : 'Readed',
								msg_id : msg_sent_id
							}
						},function(errID,obj){
							console.log('MessageGet[Readed]',errID,obj);
							mail.BoxRead({// Read User Box messages - subject only...
								sender : {
									id : 2,
									Box : 'Readed'
								}
							},function(list){
								console.log('BoxRead[Readed]',list);
								mail.BoxRead({
									sender : {
										id : 2,
										Box : 'Inbox'
									}
								},function(list){
									mail.BoxDelete({
										sender : {
											id : 2,
											Box : 'Readed'
										}
									},function(err){
										//MessageGet - read message
										console.log('BoxRead[Inbox]',list);
										mail.UserDelete({ sender : {	id : 1 } },function(err){//delete user and boxes and messages
											mail.UserDelete({ sender : {	id : 2 } },function(err){
											
											});
										});
									});
								})
							})
						})
					});
				});
			})
		});
		*/
		
		app.post('/'+mode+'/:action', handle_action);
		app.get('/'+mode+'/:action',handle_action);
		
	},
	mailLib.AttachmentPath
);
