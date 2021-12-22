import fetch from 'node-fetch';
import http from "http";
import pg from "pg";
import express from 'express';
import {create} from 'express-handlebars';
/*
Execute following commands in psql before running for first time:-
CREATE DATABASE crypto
CREATE TABLE top_ten (name VARCHAR PRIMARY KEY, last float(10), buy float(10), sell float(10), volume float(10), base_unit VARCHAR);
*/
const app= express();
var connectionStr= "postgresql://postgres:postgres@localhost:5432/crypto";
var client= new pg.Client(connectionStr);
client.connect();
client.query('DELETE FROM top_ten;')
var last_time;
fetch("https://api.wazirx.com/api/v2/tickers").then(async (data)=>{
        var masterJSON= await data.json();
        var counter=0;
        for (const key in masterJSON){
            if (masterJSON.hasOwnProperty(key)){
                var queryString= `INSERT INTO top_ten (name, last, buy, sell, volume, base_unit) VALUES ('${masterJSON[key]["name"]}',${masterJSON[key]["last"]},${masterJSON[key]["buy"]},${masterJSON[key]["sell"]},${masterJSON[key]["volume"]},'${masterJSON[key]["base_unit"]}');`;
                //console.log(queryString);
                client.query(queryString);
                counter+=1;
            }
            if (counter==10){
                break;
            }
        }
        last_time=Date.now();
    });
const hbars= create({
defaultLayout:'main', 
extname:'.hbs',
helpers:{add(value, options){return parseInt(value)+1;},}
});
app.engine('hbs', hbars.engine);
app.set('view engine', 'hbs');
app.get("/", async (request,response)=>{
if (Date.now()-last_time>59000){ //updating the database if last update was more than 59 seconds ago
await fetch("https://api.wazirx.com/api/v2/tickers").then(async (data)=>{
        var masterJSON= await data.json();
        var counter=0;
        var topTen=[];
        client.query("DELETE FROM top_ten;");
        for (const key in masterJSON){
            if (masterJSON.hasOwnProperty(key)){
                topTen.push(masterJSON[key]);
                var queryString=`INSERT INTO top_ten (name, last, buy, sell, volume, base_unit) VALUES ('${masterJSON[key]["name"]}',${masterJSON[key]["last"]},${masterJSON[key]["buy"]},${masterJSON[key]["sell"]},${masterJSON[key]["volume"]},'${masterJSON[key]["base_unit"]}');`;
                //console.log("inside", queryString);
                client.query(queryString);
                counter+=1;
            }
            last_time=Date.now();
            if (counter==10){
                break;
            }
        }
    });
}
    var result= client.query("SELECT * from top_ten", (err, result)=>{
        for (var i=0; i<10; i++){
            for (const key in result.rows[i]){
                if (!isNaN(result.rows[i][key])){
                    const prefix= ["buy", "sell", "last"].includes(key)?"₹ ":"";
                    result.rows[i][key]=prefix+result.rows[i][key].toLocaleString("en-IN");
                }
            }
        }
        if (err){
         console.log(err.stack);
        }
        else{
            //response.end(JSON.stringify(result.rows));
            response.setHeader("Content-type","text/html");
            if (request.query.table){
                response.render('table', {data: result.rows, layout:false});
            }
            else{
                response.render('home', {data: result.rows});
            }
        }
    });
});
app.listen(8080);