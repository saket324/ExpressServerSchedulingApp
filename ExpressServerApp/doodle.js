const express = require('express');
const newConnection = require('./DBconnect');

//Admin Login 

const userAdmin = 'admin';
const passAdmin = 'password';
const doodle = express();

//Serving static content
doodle.use(express.static('static'));

doodle.use(express.urlencoded({
        extended: true
}));

//Admin Page 
doodle.post('/admin', (req, res) => {

    //Verifying Log in Credentials 
    if(req.body.adminUser === userAdmin && req.body.adminPassword === passAdmin)
    {
        console.log("Login accepted")
        let conn = newConnection();
        conn.connect();

        let content = '<div><div><h2>Admin Portal</h2> (Input availability and times)</div>'
                    +'<table style="min-width: 100vw; padding: 5px 15px">';  
            
        conn.query(`SELECT Name, TimesAvailable
                    FROM Availability
                    ORDER BY Name,
                    case Name when "Admin" then '1' else '2' end
                    `, (err,rows,fields) => {
                        if (err)
                            console.log(err);
                        else {
                            //Assigning current order of times to 'time_Admin' 
                            let time_Admin = JSON.parse(rows[0].TimesAvailable)
                            //Shifting array and Admin is moved 
                            rows.shift();
                    
                            content +='<table style="min-width: 100vw; padding: 5px 15px">'
                                    +'<form action="/admin/timechanged" method="post" style="display:table-header-group; vertical-align: left">'
                                    +'<tr>'
                                    +'<th>Name</th>';
                            
                            //Inputting time into columns 
                            for (var i=0; i<10; i++)
                            {
                                content += '<th><input type="time" id="t' + i + '" name="t' + i + '" value="' + time_Admin[i] + '"></th>'
                            }

                            //"Saving Changes"
                            content +='</tr>'
                                +'<tr>'
                                +'<th></th>'
                                +'<th colspan="10"><button type="submit" id="save-times-btn">Save Time Slot Changes</button></th>'
                                +'</tr>'
                                +'</form>'
                                +'<form action="/admin/availabilitychanged" method="post">';

                            //Rows added to displayed table for user
                            for(r of rows) { 
                                let times = JSON.parse(r.TimesAvailable);  

                                content += '<tr><td style="text-align: center; width:175px"><input type="text" id="' + r.Name + '-row" value="' + r.Name + '" readonly></td>';
                                
                                //Addiing check box for each time
                                for(var i = 0; i < time_Admin.length; i++){ 
                                    // Checking what current availability is set to
                                    if(times[`${time_Admin[i]}`]) { 
                                        content += '<td style="text-align: left"><input type="checkbox" id="' + r.Name + 'Box' + i + '" name="' + r.Name + 'Box' + i + '" checked="checkced"></td>';
                                    } else {
                                        content += '<td style="text-align: left"><input type="checkbox" id="' + r.Name + 'Box' + i + '" name="' + r.Name + 'Box' + i + '"></td>'; 
                                    }
                                }
                                content += '</tr>';
                            }
                            
                            content +='<tr>'
                                    +'<th></th>'
                                    +'<th colspan="10"><button type="submit" id="save-avail-btn">Save Availability Changes</button></th>'
                                    +'</tr></form></table></div>';

                            // Sending response       
                            res.send(content);
                        }
                    });
        conn.end();
    } else {    //Failure if logging in
        res.redirect("/");
    }
});

//Availability changing
doodle.post('/admin/availabilitychanged', (req, res) => {
    let times = [];         
    let users = [];         
    let updates = [];       
    let updateStr = `Update Availability Set LastUpdate = CURRENT_TIME(), TimesAvailable = (case Name `; 

    let conn = newConnection();
    conn.connect();
     
    // Selecting name and time available, Admin first
    conn.query( `select Name, TimesAvailable from Availability order by Name, case Name when "Admin" then '1' else '2' end`
            , (err,rows,fields) => {
                if (err) {
                    console.log(err);
                    conn.end();
                    res.send("Error. Update failed.");
                } else { 
                    times = JSON.parse(rows[0].TimesAvailable); //Array of admin times
                    rows.shift();                               

                    for(r of rows) {
                        users.push([r.Name, JSON.parse(r.TimesAvailable)]); 
                    }
 
                    // Comparing users available times in database and if they match display
                    for(var i = 0; i < users.length; i++) { 
                        for(var j = 0; j < 10; j++) { 
                            //If index is not in update array or stored available times do not match display..
                            if(!updates.includes(i) && !((req.body[`${users[i][0] + "Box" + j}`] == "on") == users[i][1][`${times[j]}`]) ) {
                                updates.push(i);
                            }  
                            // Update the user object
                            users[i][1][`${times[j]}`] = (req.body[`${users[i][0] + "Box" + j}`] == "on");
                        }
                    }
 
                    for(u of updates) {
                        updateStr += `When '` + users[u][0] + `' then '` + JSON.stringify(users[u][1]) + `' `;
                    }

                    updateStr += `Else (TimesAvailable) End)`;

                    //Updates database
                    if (updates.length > 0) {   
                       conn.query(updateStr, (err,rows,fields) => {
                            if(err) {
                                console.log(err);
                                res.send("Error: update failed");
                            } else {
                                res.send('Time changes updated in database. Refresh to view changes.');
                            }
                        })
                    } else {
                        res.send("No updates were necessary.");
                    }
                    conn.end();
                }
    })
});

//Changes to Admin time slots
doodle.post('/admin/timechanged', (req, res) => {
    let newTime = [];              
    let duplicateError = false;     

    //Checking for duplicate times with for loop and changing error value if duplicate is found
    for (var i = 0; i < 10; i++) {                          
        if(newTime.includes(req.body[`${"t" + i}`])) {     
            duplicateError = true;       
            i = 10;                 
        } 
        newTime.push(req.body[`${"t" + i}`]); //add new time to array
    }

    newTime.sort();   //Organizing times in ascending order

    if (!duplicateError) {
        let conn = newConnection();
        conn.connect();

        //Updating Available times
        conn.query( `update Availability set LastUpdate = CURRENT_TIME(), TimesAvailable = '` + JSON.stringify(newTime) + `' where Name = "Admin"`
                , (err,rows,fields) => {
                    if (err) {
                        console.log(err);
                        res.send("Changes failed: please try again");  
                    } else {
                        res.send("Success: refresh to see changes.");
                    }
                });
        conn.end();
    } else {
        res.send("Failed: DUPLICATE VALUE ENTERED");
    }
});

//Guest Page 
doodle.get('/guest', (req, res) => {
    let conn = newConnection();
    conn.connect();
    let content = '<div><h3>Doodle App<h3></div>';

    conn.query( `select Name, TimesAvailable from Availability order by Name, case Name when "Admin" then '1' else '2' end`
            , (err,rows,fields) => {
                if (err) {
                    console.log(err);
                    res.send("Unknown Error");
                } else {
                    let adminTimes = JSON.parse(rows[0].TimesAvailable);   
                    rows.shift();                                       

                    content += '<table style="min-width: 100vw; padding: 5px 15px">'
                                    +'<form method="post" action="/guest/register" style="display:table-row-group; vertical-align: middle; border-color: inherit">'
                                        +'<thead>'
                                            +'<tr>'
                                                +'<th>Name</th>';

                    for(var i = 0; i < 10; i ++) {
                        content += '<th><input type="time" name="t' + i + '" value="' + adminTimes[i] + '" readonly></th>';
                    }

                    content +='</tr></thead><tbody>';

                    for(r of rows) {                                
                        let times = JSON.parse(r.TimesAvailable);  

                        content += '<tr><td style="text-align: center; width:175px"><input type="text" id="' + r.Name + '-row" name="otherNames" value="' + r.Name + '" readonly></td>';
  
                        for(var i = 0; i < adminTimes.length; i++){
                            //Adding checkbox
                            if(times[`${adminTimes[i]}`]) {
                                content += '<td style="text-align: center"><input type="checkbox" id="' + r.Name + '-box-' + i + '" checked="' + ( (times[`${adminTimes[i]}`]) ? "checked" : "") + '" onclick="return false;"></td>'; // If errors occur check here **************************************
                                 } else {
                                    content += '<td style="text-align: center"><input type="checkbox" id="' + r.Name + '-box-' + i + '" onclick="return false;"></td>';
                                } 
                        }
                        content += '</tr>';
                    }

                    content += '<tr>'
                                    +'<td style="text-align: center; width:175px">'
                                        +'<input type="text" id="guest-name" name="guestName" placeholder="Name">'
                                    +'</td>';

                    for(var i = 0; i < 10; i++) {
                        
                        content += '<td style="text-align: center"><input type="checkbox" name="box' + i + '"></td>'; //Adding check box for guest
                    }

                    //Guest save button
                    content += '</tr><tr><td style="text-align:center" colspan=11><button type="submit">Add Availability</button></td></tr></tbody></form></table></div>';
                    res.send(content);
                }
            });
    conn.end();
});

//Guest Availability
doodle.post('/guest/register', (req, res) => { 
    if(req.body.otherNames == null)
    {
        let conn = newConnection();
        conn.connect();

        let newAvailability = {}; 
 
        //'t/f' for checkboxes 
        for (var i = 0; i < 10; i++) {
            newAvailability[req.body[`${"t" + i}`]] = (req.body[`${"box" + i}`] === "on");
        }

        //Adding new guest to DB
        conn.query( `insert into Availability values("` + req.body.guestName + `",CURRENT_TIME(),'` + JSON.stringify(newAvailability) + `')`
                , (err,rows,fields) => {
                    if (err) {
                        console.log(err);
                        res.send("Failed: please retry.");
                    } else {
                        res.redirect("/guest"); 
                    }
                });
        conn.end(); 
    }
    //Checking if duplicate guest names
    else if (!(req.body.otherNames).includes(req.body.guestName)) {
        let conn = newConnection();
        conn.connect();

        let newAvailability = {}; 
 
        //'t/f' for checkboxes 
        for (var i = 0; i < 10; i++) {
            newAvailability[req.body[`${"t" + i}`]] = (req.body[`${"box" + i}`] === "on");
        }

        //Adding new guest to DB
        conn.query( `insert into Availability values("` + req.body.guestName + `",CURRENT_TIME(),'` + JSON.stringify(newAvailability) + `')`
                , (err,rows,fields) => {
                    if (err) {
                        console.log(err);
                        res.send("Failed: please retry.");
                    } else {
                        res.redirect("/guest"); //Successful registration redirects guest to /guest directory
                    }
                });
        conn.end(); 
   } else {
       res.send("Error : Duplicate name entered.");
   } 
});

doodle.listen(80);