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
        var DateTime = null;
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
        var proxyBase = "https://withered-bar-1e53.chasekidder.workers.dev";
        var targetUrl = "https://bus.gocitybus.com/Schedule/GetStopSchedules";
        var url = proxyBase + "?" + targetUrl;
        return url;
    },

    getData: function () {
        var date = "2020-09-16";
        var payload = JSON.stringify({ "stopCode": "BUS519W", "date": date });
        var url = this.getUrl();

        var httpOptions = {
            method: "POST",
            headers: new Headers({ 'content-type': 'application/json' }),
            
        };
        httpOptions.body = payload;

        fetch(url, httpOptions).then(response => response.text()).then(data => {this.processData(data)});
    },

    scheduleUpdate: function (delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }
        nextLoad = nextLoad;
        var self = this;
        setTimeout(function () {
            self.getData();
        }, nextLoad);
    },

    getDom: function () {
        var self = this;

        // create element wrapper for show into the module
        var wrapper = document.createElement("div");

        if (this.schedule) {
            console.log(this.schedule)
            // Create DIV to contain Route Info
            var wrapperRouteInfo = document.createElement("div");
            wrapperRouteInfo.innerHTML = "Loading Route Information...";

            // Create Label for Route Info
            var labelRouteInfo = document.createElement("label");
            labelRouteInfo.innerHTML = this.schedule.routeName + " " + this.schedule.routeDirection;

            wrapper.appendChild(labelRouteInfo);

            // Create Table of Bus Arrivals
            var tableBusArrivalsWrapper = document.createElement("div");

            var numberOfArrivals = Object.keys(this.schedule.arrivalTimes).length 
            var arrivalTimesToShow = [];
            for (let i = numberOfArrivals; i > (numberOfArrivals - this.config.numberOfArrivals); i--) {
                arrivalTimesToShow.push(this.schedule.arrivalTimes[i]);
            }

            arrivalTimesToShow = arrivalTimesToShow.reverse();

            for (let i = 0; i < this.config.numberOfArrivals; i++){
                var tableBusArrival = document.createElement("div");
                tableBusArrival.innerHTML = arrivalTimesToShow[i];

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
        
        var numReturnedTimes = Object.keys(rawSchedule.stopTimes).length 

        for (let i = (numReturnedTimes - 1); i > 0; i--) {

            var tzOptions = {hour: '2-digit', minute: '2-digit'};

            var serverTime = new Date(rawSchedule.stopTimes[i].scheduledDepartTimeUtc);

            localTime = serverTime.toLocaleTimeString([], tzOptions);

            this.schedule.arrivalTimes[i] = localTime;
          };
        
    },

    processData: function (data) {
        var self = this;
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

