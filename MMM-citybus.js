/*
 * Copyright 2020 Chase Kidder
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/*
 * Some Portions of Code Are Licensed Under:
 *      The MIT License (MIT)
 *      Copyright (c) 2017 Rodrigo Ramírez Norambuena 
 */



/* global Module */

/* Magic Mirror
 * Module: MMM-citybus
 */

Module.register("MMM-citybus", {
    defaults: {
        updateInterval: 60000,
        retryDelay: 30000,
        stopCode: 'BUS519W',
        numberOfArrivals: 3,
        displayTimeOption: 'time',
        timeZone: 'America/New_York',
        locale: "en-US",
    },

    requiresVersion: "2.1.0", // Required version of MagicMirror

    start: function () {
        var self = this;
        var schedule = null;
        var dataNotification = null;
        

        //Flag for check if module is loaded
        this.loaded = false;

        // Schedule update timer.
        this.getData();
        setInterval(function () {
            self.updateDom();
            console.log("Updating!");
        }, this.config.updateInterval);
    },

    getUrl: function () {
        let proxyBase = "https://withered-bar-1e53.chasekidder.workers.dev";
        let targetUrl = "https://bus.gocitybus.com/Schedule/GetStopSchedules";
        let url = proxyBase + "?" + targetUrl;
        return url;
    },

    formatDate: function (date) {
        let d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2) 
            month = '0' + month;
        if (day.length < 2) 
            day = '0' + day;

        return [year, month, day].join('-');
    
    },

    formatTime: function (dateISO) {
        let tzOptions = {hour: '2-digit', minute: '2-digit', hour12: false};

        return new Date(dateISO).toLocaleTimeString([], tzOptions);
    },

    getData: function () {
        let date = this.formatDate(Date.now());

        let payload = JSON.stringify({ "stopCode": this.config.stopCode, "date": date });
        let url = this.getUrl();

        let httpOptions = {
            method: "POST",
            headers: new Headers({ 'content-type': 'application/json' }),
            
        };
        httpOptions.body = payload;

        fetch(url, httpOptions).then(response => response.text()).then(data => {this.processData(data)});
    },

    scheduleUpdate: function (delay) {
        let nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }
        nextLoad = nextLoad;
        let self = this;
        setTimeout(function () {
            self.getData();
        }, nextLoad);
    },

    getClosestArrivals: function () {
        let now = new Date(Date.now());

        let numberOfArrivals = Object.keys(this.schedule.arrivalTimes).length 
        let result = [];
        let next = 0;

        // Search for closest date/time
        for (let i = 0; i < numberOfArrivals; i++) {
            let date = new Date(this.schedule.arrivalTimes[i]);
            if (date > now){
                next = i;
                break;
            }
        }

        // Get n times after that
        console.log(next);
        for (let i = next; i < (next + this.config.numberOfArrivals); i++) {
            result.push(this.schedule.arrivalTimes[i]);
        }

        //console.log(result);
        return result;
    
    },

    getDom: function () {
        let self = this;

        // create element wrapper for show into the module
        let wrapper = document.createElement("div");

        if (this.schedule) {
            console.log(this.schedule)
            // Create DIV to contain Route Info
            let wrapperRouteInfo = document.createElement("div");
            wrapperRouteInfo.innerHTML = "Loading Route Information...";

            // Create Label for Route Info
            let labelRouteInfo = document.createElement("label");
            labelRouteInfo.innerHTML = this.schedule.routeName + " " + this.schedule.routeDirection;

            wrapper.appendChild(labelRouteInfo);

            // Create Table of Bus Arrivals
            let tableBusArrivalsWrapper = document.createElement("div");

            let arrivalTimesToShow = this.getClosestArrivals();
            
            // Creat the HTML Objects
            for (let i = 0; i < this.config.numberOfArrivals; i++){
                let tableBusArrival = document.createElement("div");
                tableBusArrival.innerHTML = this.formatTime(arrivalTimesToShow[i]);

                tableBusArrivalsWrapper.appendChild(tableBusArrival);
            }

            wrapper.appendChild(tableBusArrivalsWrapper);

        }

        return wrapper;
    },

    getScripts: function() {
		return [];
	},

    getStyles: function () {
        return [
            "css/MMM-citybus.css",
        ];
    },

    parseSchedule: function (rawSchedule) {
        rawSchedule = rawSchedule.routeStopSchedules[0]

        this.schedule = {
            routeName: rawSchedule.routeNumber + " " + rawSchedule.routeName,
            routeDirection: rawSchedule.directionName,
            stopCode: this.config.stopCode,
            arrivalTimes: {},
        };
        
        let numReturnedTimes = Object.keys(rawSchedule.stopTimes).length 

        for (let i = (numReturnedTimes - 1); i > 0; i--) {
            this.schedule.arrivalTimes[i] = rawSchedule.stopTimes[i].scheduledDepartTimeUtc;
          };
        
    },

    processData: function (data) {
        let self = this;
        if (this.loaded === false) { self.updateDom(self.config.animationSpeed); }
        this.loaded = true;

        self.parseSchedule(JSON.parse(data));

        self.updateDom();

    },

    // socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if(notification === "MMM-citybus-GOT-LOCAL-TIME") {
			// set dataNotification
			this.dataNotification = payload;
			this.updateDom();
		}
	},


});

