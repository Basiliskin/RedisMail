# RedisMail

>  this server shouldnt be visible outside docker,there is no user login/verification...
> this only messeges manager ,where each message stored for specific period of time,handled by redis - it's not like normal mail server do,messages stored until deleted.
> 

#### Simple Web Mail server docker image :
  - Dockerfile is for ARM processor.(but it can be rewriten for other CPU as well)
  - web mail server based on Express for NodeJS and Redis server.
  - when running container ,redis must be specified - "--link redis:redis"

# open source projects to work properly:
    - node.js
    - redis-eval
    - synchronize
    - express
    - crypto
    - redis
    - connect-redis
    - connect-busboy
# Demo :
    - once container started the demo can be accessed at :
        http://127.0.0.1:8090/prod/index.html
        * it contains API request samples(MailUser).
# API :
####   create Mailbox for user:
> mail.BoxCreate({ // CREATE USER and hes Boxes
> 		sender : {
>>			id : 1, /* user id,can be string as well*/
> 			Box : ['Inbox','Sent','Readed'] /* array of mailboxes to create */
> 		}
> 	},function(err){});
	
####   list user mailboxes  :
> mail.BoxList({
>> 				sender : {
> 					id : 1 /* user id,can be string as well*/
> 				}
> 			},function(err,list){});

#### delete user mailbox and it's messages 
>	mail.BoxDelete({
>>		sender : {
>>			id : 2,/* user id,can be string as well*/
>>			Box : 'Readed' /* mailbox[A] to delete */
>>		}
>>	},function(err){})

#### read user mailbox messages - subject only...
>	mail.BoxRead({
>			sender : {
>>				id : 2,/* user id,can be string as well*/
>>				Box : 'Readed' /* mailbox[A] where it stored */
>>			}
>	},function(list){})

#### send message from user[A] to user[B]
>mail.MessageAdd({
>>		sender : {
>>			    id : 1, /* A - user id,can be string as well*/
>>				Box : 'Sent',/* mailbox where it will be stored */
>>				name : 'Dima', /* user name */
>>				Subject : 'Subject - .....', /* subject */
>>				Msg : 'Message body' /* body */
>>		},
>>			receiver : {
>>				id : 2,/* B - user id,can be string as well*/
>>				Box : 'Inbox',/* mailbox where it will be stored */
>>				name : 'Test' /* user name */
>>			}				
>		},function(err,sent/* message id */){})
#### Move message from maibox[A] to mailbox[B]:
>mail.MessageMove({ 
>>		sender : {
			id : 2,/* user id,can be string as well*/
			Box : 'Inbox',/* mailbox[A] where it stored */
			BoxNew : 'Readed',/* mailbox[B] where it will be stored */
			msg_id : /* message id in mailbox[A] */
		}
	},function(err,msg_sent_id /* new message id in mailbox[B] */){});
	
#### read message body fom mailbox[A]:
> mail.MessageGet({
>  sender : {
>>		id : 2,/* user id,can be string as well*/
>>		Box : 'Readed',/* mailbox[A] where it stored */
>>		msg_id : msg_sent_id  /* message id in mailbox[A] */
>>	}
>   },function(errID,obj/* message object,containing all data */){});

#### delete user and it's mailboxes with messages 
>	mail.UserDelete({ sender : {	id : 2 /* user id,can be string as well*/ } },function(err){})

License
----

MIT


**Free Software, Hell Yeah!**

[//]: # (These are reference links used in the body of this note and get stripped out when the markdown processor does its job. There is no need to format nicely because it shouldn't be seen. Thanks SO - http://stackoverflow.com/questions/4823468/store-comments-in-markdown-syntax)


   
   [node.js]: <http://nodejs.org>
   
 