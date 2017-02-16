var 
	mailLib = require('./mailbox.js'),
	exec = require('child_process').exec,
	clearEachDay = 7,
	e = 60 * 24 * clearEachDay,	
	seconds = 3600;

var clearDate;

function cache_clear(path){
	var now = new Date();
	if(!clearDate || clearDate<now){
		clearDate = new Date(now.getTime() + (1000 * seconds));
		var cmd = 'find '+mailLib.AttachmentPath+' -type f -mmin +'+e+' -delete';//'find '+path+' -type f -mmin +1 -exec /bin/rm -f {} \\';
		exec(cmd, function(err, stdout) { console.log('exec',cmd,err,stdout) });
	}
};

setInterval(function(){
	cache_clear(mailLib.AttachmentPath);
},1000);