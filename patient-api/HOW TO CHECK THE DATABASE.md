# STEP 1: Run a Tunnel

ssh -fNv -i ~/.ssh/FuseHealth-Pem-Key.pem \
 -L 127.0.0.1:55432:database-1.cv8g82kya3xt.us-east-2.rds.amazonaws.com:5432 \
ec2-user@3.146.121.203

chmod 400 /Users/danielmeursing/.ssh/FuseHealth-Pem-Key.pem

# OR WITH AUTOSSH:

AUTOSSH_GATETIME=0 \
AUTOSSH_POLL=30 \
autossh -M 0 -f -N \
  -i ~/.ssh/FuseHealth-Pem-Key.pem \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "TCPKeepAlive=yes" \
  -o "ExitOnForwardFailure=yes" \
  -p 54322 \
  -L 127.0.0.1:55432:database-1.cv8g82kya3xt.us-east-2.rds.amazonaws.com:5432 \
  ec2-user@3.140.178.30

# STEP 2: Configure pgAdmin / Beekeeper Studio

Use the port you defined above (55432) and localhost address for the Host: 127.0.0.1

# NOTE: Debug auto ssh:

# Check if its running:

    pgrep -fl autossh

# Kill it (the previous method shows the process id):

    kill 5651

# Check if killed:

    pgrep -fl autossh

Run it again, then check it again.
