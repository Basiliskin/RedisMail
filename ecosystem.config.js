module.exports = {
  apps : [
	{
      name      : "mailer",
      script    : "/opt/app/mailer/mailer.js",
      instances : 1,
      exec_mode : "cluster"
    },
	{
      name      : "cron",
      script    : "/opt/app/mailer/cron.js",
      instances : 1,
      exec_mode : "cluster"
    }
  ]

}
