const 
	reval 	= require('redis-eval'),
	exec = require('child_process').exec,
	sync = require('synchronize'),
	SERVER_PREFIX = '$REDIS_MAIL$_';
	USERS_KEY = SERVER_PREFIX+'_%USER%',
	attachmentPath = __dirname+'/attachment/';
	sname = __dirname + '/script/msg_id.lua';
	
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
}
function touchAttachment(file,days,cb){
	file = attachmentPath + file;
	var hours = parseInt(days) * 24;
	var cached = ' + '+hours+' hours';
	exec('touch -d "$(date -R -r '+file+')'+cached+'" '+file, function(err, stdout) {
		cb(err, stdout);
	});
};
function MailBox(client){
	this.client = client;
}
MailBox.prototype.UserDelete = function(body,cb){
	var self = this;
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}	
	var user_id = Sender.id;
	var client = self.client;
	sync.fiber(function() {
		var user = sync.await(self.GetUserNameEx(Sender.id, sync.defers()));
		user = user && user.length ? user[0] : false;
		if(!user){
			console.log('UserDelete[User]',user);
			cb('UserDelete[User]:Invalid');
			return;
		}
		var multi = client.multi();
		var list = sync.await(self.BoxList({
			sender : {
				id : user_id
			}
		},sync.defers(),true));
		list = list && list.length ? list[0] : [];
		console.log('UserDelete[list]',list); 
		for(var z=0;z<list.length;z++){
			var sender = {
				id : user_id,
				Box : list[z]
			};
			var READ_BOX = self.GetBoxName(sender);
			console.log('UserDelete[READ_BOX]',READ_BOX); 
			var all = sync.await(client.hgetall(READ_BOX, sync.defers()));
			if(all.length){
				for(var i=0;i<all.length;i++){
					var item = all[i];
					for(var j in item){
						//if(j=='msg_id') continue;
						var msg_name = self.GetMessageName(sender,j);
						multi.del(msg_name);
						multi.hdel(READ_BOX,j);
					}
				}
			}
			multi.hdel(user,READ_BOX);
			multi.hdel(user,READ_BOX+'c');
		}
		
		multi.hdel(USERS_KEY,user);
		multi.del(user);
		
		var del = sync.await(multi.exec(sync.defers()));
		console.log('UserDelete',del); 
		cb(false);
	});
	
}
MailBox.prototype.GetUserNameEx = function(user_id,cb){
	var self = this;
	var name = self.GetUserName(user_id);
	var client = self.client;
	client.hset(USERS_KEY,name,user_id, function(err,replay){
		cb(err,name);
	});
};
MailBox.prototype.GetUserName = function(user_id){
	return SERVER_PREFIX+'USER_'+user_id;
};
MailBox.prototype.GetBoxName = function(Sender,Box){
	var box = (Box || Sender.Box);
	box = box.replaceAll('"','').replaceAll("'",'');//no json problems
	return SERVER_PREFIX+box+'_'+Sender.id;
};
MailBox.prototype.GetMessageName = function(Sender,msg_id,Box){
	return this.GetBoxName(Sender,Box)+'_'+Sender.id+'_'+msg_id;
};

MailBox.prototype.BoxCreate = function(body,cb){
	var self = this;
	
	var client = self.client;
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	sync.fiber(function() {
		var user = sync.await(self.GetUserNameEx(Sender.id, sync.defers()));
		user = user && user.length ? user[0] : false;
		if(!user){
			console.log('BoxCreate[User]',user);
			cb('BoxCreate[User]:Invalid');
			return;
		}
		var multi = client.multi();
		for(var i=0;i<Sender.Box.length;i++){
			var READ_BOX = self.GetBoxName(Sender,Sender.Box[i]);
			var msg = sync.await(client.hexists(user,READ_BOX, sync.defers()));
			var ok = msg && msg.length && msg[0]==1;
			if(!ok)
			{
				// not exist create
				multi.hset(user,READ_BOX,Sender.Box[i]);
				multi.hset(user,READ_BOX+'c',1);
			}			
		}
		var exec = sync.await(multi.exec(sync.defers()));
		//console.log('BoxCreate',exec);
		cb(false);
	});
}

MailBox.prototype.BoxList = function(body,cb,getall){
	var self = this;
	var client = self.client;
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}

	sync.fiber(function() {
		var user = sync.await(self.GetUserNameEx(Sender.id, sync.defers()));
		user = user && user.length ? user[0] : false;
		if(!user){
			console.log('BoxList[User]',user);
			cb('BoxList[User]:Invalid');
			return;
		}
		var all = sync.await(client.hgetall(user, sync.defers()));
		
		all = all && all.length ? all[0] : {};
		
		var list = [];
		for(var a in all){
			if(!getall && a.indexOf('_'+Sender.id+'c')>0) continue;
			list.push(all[a]);
		}
		console.log('BoxList['+Sender.id+']',user,all,list);
		cb(false,list);
	});
}

MailBox.prototype.BoxRead = function(body,cb){
	var self = this;
	var client = self.client;

	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	
	
	sync.fiber(function() {
		var list = [];
		var READ_BOX = self.GetBoxName(Sender);
		var all = sync.await(client.hgetall(READ_BOX, sync.defers()));
		if(all.length){
			var multi = client.multi();
			for(var i=0;i<all.length;i++){
				var item = all[i];
				console.log('BoxRead',i,item); 
				for(var j in item){
					//if(j=='msg_id') continue;
					var msg_name = self.GetMessageName(Sender,j);
					console.log('BoxRead',j,msg_name); 
					var msg = sync.await(client.exists(msg_name, sync.defers()));
					msg = msg && msg.length>0 ? msg[0] : false;
					if(!msg){
						// delete 
						multi.del(msg_name);
						multi.hdel(READ_BOX,j);
					}else{
						list.push(item);
					}
				}
			}
			var del = sync.await(multi.exec(sync.defers()));
			console.log('BoxRead[delete]',del,list); 
		}
		
		cb(list);
	});
}

MailBox.prototype.BoxDelete = function(body,cb){
	var self = this;
	var client = self.client;

	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	
	
	sync.fiber(function() {
		var user = sync.await(self.GetUserNameEx(Sender.id, sync.defers()));
		user = user && user.length ? user[0] : false;
		if(!user){
			console.log('BoxList[User]',user);
			cb('BoxList[User]:Invalid');
			return;
		}
		
		var READ_BOX = self.GetBoxName(Sender);
		var all = sync.await(client.hgetall(READ_BOX, sync.defers()));
		var multi = client.multi();
		if(all.length){
			for(var i=0;i<all.length;i++){
				var item = all[i];
				for(var j in item){
					//if(j=='msg_id') continue;
					var msg_name = self.GetMessageName(Sender,j);
					multi.del(msg_name);
					multi.hdel(READ_BOX,j);
				}
			}
		}
		multi.hdel(user,READ_BOX);
		multi.hdel(user,READ_BOX+'c');
		var del = sync.await(multi.exec(sync.defers()));
		console.log('BoxDelete[delete]',del); 
		cb(false);
	});
}

MailBox.prototype.BoxCount = function(body,cb){
	var self = this;
	var client = self.client;
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}

	sync.fiber(function() {
		var count = sync.await(client.hlen(self.GetBoxName(Sender), sync.defers()));
		cb(false,count && count.length ? count[0] : 0);
	});
}

MailBox.prototype.MessageSubject = function(user,title){
	return JSON.stringify({
		created : new Date().getTime(),
		user : new Buffer(user).toString("base64"),
		title : new Buffer(title).toString("base64")		
	});
}
MailBox.prototype.MessageAdd = function(body,attachment,cb){
	var self = this;
	attachment = attachment || [];
	var client = self.client;
	
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	if(!Sender.name){
		cb('Sender.name not found');
		return;
	}
	if(!Sender.Subject){
		cb('Sender.Subject not found');
		return;
	}
	if(!Sender.Msg){
		cb('Sender.Msg not found');
		return;
	}

	var Receiver = body['receiver'];
	if(!Receiver){
		cb('Receiver not found');
		return;
	}
	if(!Receiver.id){
		cb('Receiver.id not found');
		return;
	}
	if(!Receiver.Box){
		cb('Receiver.Box not found');
		return;
	}
	if(!Receiver.name){
		cb('Receiver.name not found');
		return;
	}

	var sender_id = Sender.id;
	var receiver_id = Receiver.id;
	

	var SENT_BOX = self.GetBoxName(Sender);
	var INBOX_BOX = self.GetBoxName(Receiver);
	var dafter = body['delete_after_day'] || '0';
	dafter = parseInt(dafter);
	var key_expire_at = dafter*3600+60;
	var now = new Date().getTime();
	var expire = now + key_expire_at * 1000;
	sync.fiber(function() {
		var suser = sync.await(self.GetUserNameEx(sender_id, sync.defers()));
		suser = suser && suser.length ? suser[0] : false;
		if(!suser){
			console.log('MessageAdd[Sender]',suser);
			cb('MessageAdd[Sender]:Invalid');
			return;
		}
		var ruser = sync.await(self.GetUserNameEx(receiver_id, sync.defers()));
		ruser = ruser && ruser.length ? ruser[0] : false;
		if(!ruser){
			console.log('MessageAdd[Receiver]',ruser);
			cb('MessageAdd[Receiver]:Invalid');
			return;
		}
		/* create folder if not exists */
		var msg = sync.await(client.hexists(suser,SENT_BOX, sync.defers()));
		var ok = msg && msg.length && msg[0]==1;
		if(!ok){
			client.hset(suser,SENT_BOX,Sender.Box);
			client.hset(suser,SENT_BOX+'c',1);
		}

		/* create folder if not exists */
		msg = sync.await(client.hexists(ruser,INBOX_BOX, sync.defers()));
		ok = msg && msg.length && msg[0]==1;
		if(!ok){
			client.hset(ruser,INBOX_BOX,Receiver.Box);
			client.hset(ruser,INBOX_BOX+'c',1);
		}
		

		var msg_sent_id  = 'M.'+sync.await(reval(client, sname, [suser],[SENT_BOX+'c'] , sync.defers()));
		var msg_inbox_id = 'M.'+sync.await(reval(client, sname, [ruser],[INBOX_BOX+'c'], sync.defers()));
		
		function create_msg(msg_id,ref_id){
			var msg = {
				expire : expire,
				date : new Date().getTime(),
				msg_id : msg_id,
				ref_id : ref_id,
				attachment : attachment,// list of files to request { name : filename,path : value 	}
				Sender : {
					id : Sender.id,
					name : Sender.name,
					box : Sender.Box
				},
				Receiver : {
					id : Receiver.id,
					name : Receiver.name,
					box : Receiver.Box
				},
				Message : new Buffer(Sender.Msg).toString("base64")
			};
			return JSON.stringify(msg);
		}
		for(var f=0;f<attachment.length;f++){
			var touch = sync.await(touchAttachment(attachment[i].path,dafter,sync.defers()));
		}
		var multi = client.multi();
		multi.hset(SENT_BOX ,[ msg_sent_id , self.MessageSubject(Receiver.name,Sender.Subject)]);
		multi.hset(INBOX_BOX,[ msg_inbox_id, self.MessageSubject(Sender.name,Sender.Subject )]);

		
		multi.setex(self.GetMessageName(Sender,msg_sent_id) ,key_expire_at,create_msg(msg_sent_id,msg_inbox_id));
		multi.setex(self.GetMessageName(Receiver,msg_inbox_id),key_expire_at,create_msg(msg_inbox_id,msg_sent_id));
		
		var sent = sync.await(multi.exec(sync.defers()));
		console.log('MessageAdd',msg_inbox_id,Receiver.id);	
		cb(false,msg_inbox_id);		
	});
}
MailBox.prototype.MessageMove = function(body,cb){
	var self = this;
	var client = self.client;
	
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	if(!Sender.BoxNew){
		cb('Sender.BoxNew not found');
		return;
	}
	if(!Sender.msg_id){
		cb('Sender.msg_id not found');
		return;
	}
	
	sync.fiber(function() {
		var suser = sync.await(self.GetUserNameEx(Sender.id, sync.defers()));
		suser = suser && suser.length ? suser[0] : false;
		if(!suser){
			console.log('MessageMove[Sender]',suser);
			cb('MessageMove[Sender]:Invalid');
			return;
		}
		var BOX = self.GetBoxName(Sender,Sender.Box);
		console.log('MessageMove[BOX]',BOX); 
		
		var sent = sync.await(client.hget(BOX,Sender.msg_id,sync.defers()));
		sent = sent && sent.length ? sent[0] : false;
		if(!sent){
			console.log('MessageMove[hget]',suser,BOX,Sender.msg_id);
			cb('MessageMove[MSG]:Invalid');
			return;
		}
		console.log('MessageMove[hget]',Sender.msg_id,sent); 
		//var del  = sync.await(client.hdel(BOX,Sender.msg_id,sync.defers()));
		//multi.hset(self.GetBoxName(Sender,Sender.Box),Sender.msg_id);
		var SENT_BOX = self.GetBoxName(Sender,Sender.BoxNew);
		var msg = sync.await(client.hexists(suser,SENT_BOX, sync.defers()));
		var ok = msg && msg.length && msg[0]==1;
		if(!ok){
			client.hset(suser,SENT_BOX,Sender.BoxNew);
			client.hset(suser,SENT_BOX+'c',1);
		}
		var msg_sent_id  = 'M.'+sync.await(reval(client, sname, [suser],[SENT_BOX+'c'] , sync.defers()));
		var msg_name = self.GetMessageName(Sender,msg_sent_id,Sender.BoxNew);
		var del_msg_name = self.GetMessageName(Sender,Sender.msg_id);
		
		var Msg = sync.await(client.get(del_msg_name,sync.defers()));
		Msg = Msg && Msg.length ? Msg[0] : false;
		if(!Msg){
			console.log('MessageMove[MSG_BODY]',del_msg_name);
			cb('MessageMove[MSG_BODY]:Invalid');
			return;
		}
		
		var multi = client.multi();
		multi.hset(SENT_BOX ,[ msg_sent_id ,sent]);
		multi.set(msg_name,Msg);
		multi.hdel(BOX,Sender.msg_id);
		multi.del(del_msg_name);
		
		
		console.log('MessageMove[SET]',suser,SENT_BOX,msg_sent_id,msg_name,Msg); 
		console.log('MessageMove[DEL]',suser,BOX,Sender.msg_id,del_msg_name); 
		
		var ret = sync.await(multi.exec(sync.defers()));
		console.log('MessageMove[RET]',ret); 
		/*
		var ret = sync.await(client.hset(SENT_BOX,msg_sent_id,sent,sync.defers()));
		var ret = sync.await(client.hset(SENT_BOX,msg_sent_id,sent,sync.defers()));
		console.log('MessageMove[hset]',suser,SENT_BOX,msg_sent_id,sent,ret); 
		
		ret = sync.await(client.hdel(BOX,Sender.msg_id,sync.defers()));
		ret = sync.await(client.del(BOX,Sender.msg_id,sync.defers()));
		console.log('MessageMove[hdel]',suser,BOX,Sender.msg_id,ret); 
		*/
		cb(false,msg_sent_id);
	});	
}
MailBox.prototype.MessageDelete = function(body,cb){
	var self = this;
	var client = self.client;
	
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	if(!Sender.msg_id){
		cb('Sender.msg_id not found');
		return;
	}
	
	sync.fiber(function() {
		console.log('MessageDelete',body); 
		var multi = client.multi();
		var BOX = self.GetBoxName(Sender);
		var msg_name = self.GetMessageName(Sender,Sender.msg_id);
		multi.hdel(BOX,Sender.msg_id);
		multi.del(msg_name);
		var del = sync.await(multi.exec(sync.defers()));
		console.log('MessageDelete',del); 
		var errID = del && del.length==2 && del[0] && del[1] ? 0 : 1;
		cb(errID);
	});
}
MailBox.prototype.MessageGet = function(body,cb){
	var self = this;
	var client = self.client;
	
	var Sender = body['sender'];
	if(!Sender){
		cb('Sender not found');
		return;
	}
	if(!Sender.id){
		cb('Sender.id not found');
		return;
	}
	if(!Sender.Box){
		cb('Sender.Box not found');
		return;
	}
	if(!Sender.msg_id){
		cb('Sender.Box not found');
		return;
	}
	
	sync.fiber(function() {
		console.log('MessageGet',body); 
		var obj;
		var BOX = self.GetBoxName(Sender);
		var msg_name = self.GetMessageName(Sender,Sender.msg_id);
		var Msg = sync.await(client.get(msg_name,sync.defers()));	
		var errID = 1;
		if(Msg){
			obj = Msg && Msg.length ? Msg[0] : false;
			obj = obj ? JSON.parse(obj) : false;
			console.log('MessageGet',obj); 
			errID = obj ? 0 : 2;
		}
		cb(errID,obj);
	});
}


var lib = module.exports = {};
lib.MailBox = MailBox;
lib.AttachmentPath = attachmentPath;