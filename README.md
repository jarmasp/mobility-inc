# mobility-inc
Coding exercise, using 3 diferent laguages create 3 services for a rideshare app with a focus on payment processing and validation, the services are rider, driver and payment

drivers and rider should be bareboness, loging with social auth, a rider has initial amount of 1k funds and a driver has a initial amount of 100, driver can be a rider but can't move money to themselves, a rider can do a deposit to increase its balance and driver can withdraw its balance

a driver and a rider can view their profiles with basic info, funds, name, email 

a rider can send funds to a driver; a unique code should be generated that the driver can use to verify payment
a driver should get the payment by its unique code to verify if the payment was made to him

every transaction should go throught the payments service;
the payments service validates transactions (who sends it, to whom, amount and its unique code)
deposit and withdrawals are also transactions
