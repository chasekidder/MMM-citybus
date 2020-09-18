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
        //updateInterval: 60000,
        updateInterval: 900000,
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
        var nearestEstimate = null;
        var dataNotification = null;


        //Flag for check if module is loaded
        this.loaded = false;

        // Schedule update timer.
        this.getData();
        setInterval(function () {
            self.updateDom();
        }, this.config.updateInterval);
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
        let tzOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

        return new Date(dateISO).toLocaleTimeString([], tzOptions);
    },

    getUrl: function (targetUrl) {
        let proxyBase = "https://withered-bar-1e53.chasekidder.workers.dev";
        let url = proxyBase + "?" + targetUrl;
        return url;
    },

    sendRequest: function (url, payload, type) {
        let httpOptions = {
            method: "POST",
            headers: new Headers({ 'content-type': 'application/json' }),

        };
        httpOptions.body = payload;

        fetch(url, httpOptions).then(response => response.text()).then(data => { this.processData(data, type) });

    },

    getArrivalSchedule: function () {
        let date = this.formatDate(Date.now());

        let url = this.getUrl("https://bus.gocitybus.com/Schedule/GetStopSchedules");
        let payload = JSON.stringify({ "stopCode": this.config.stopCode, "date": date });

        this.sendRequest(url, payload, "schedule");
    },

    getArrivalEstimates: function () {
        let date = this.formatDate(Date.now());

        let url = this.getUrl("https://bus.gocitybus.com/Schedule/GetStopEstimates");
        let payload = JSON.stringify({ "stopCode": this.config.stopCode, "date": date });

        this.sendRequest(url, payload, "estimate");
    },

    getData: function () {
        this.getArrivalSchedule();
        this.getArrivalEstimates();
        this.scheduleUpdate();

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
            if (date > now) {
                next = i;
                break;
            }
        }

        // Get n times after that
        for (let i = next; i < (next + this.config.numberOfArrivals); i++) {
            result.push(this.schedule.arrivalTimes[i]);
        }

        return result;

    },

    getDom: function () {
        let self = this;

        // create element wrapper for show into the module
        let wrapper = document.createElement("div");
        wrapper.classList.add("citybus-module-wrapper");

        if (this.schedule) {

            // Create Label for Route Info
            let labelRouteInfo = document.createElement("label");
            labelRouteInfo.classList.add("route-info-label");
            labelRouteInfo.innerHTML = this.schedule.routeName + " " + this.schedule.routeDirection;

            wrapper.appendChild(labelRouteInfo);

            // Create Table of Bus Arrivals
            let tableBusArrivalsWrapper = document.createElement("div");
            tableBusArrivalsWrapper.classList.add("arrival-wrapper");

            let arrivalTimesToShow = this.getClosestArrivals();

            // Create the HTML Objects
            for (let i = 0; i < this.config.numberOfArrivals; i++) {
                let tableBusArrival = document.createElement("div");
                tableBusArrival.classList.add("arrival");

                if ((i === 0) && (this.nearestEstimate)) {
                    tableBusArrival.innerHTML = this.nearestEstimate;
                }

                else {
                    let time = this.formatTime(arrivalTimesToShow[i]);

                    if (time == "Invalid Date") {
                        tableBusArrival.innerHTML = "";
                    }

                    else {
                        tableBusArrival.innerHTML = time;
                    }

                }


                tableBusArrivalsWrapper.appendChild(tableBusArrival);
            }

            wrapper.appendChild(tableBusArrivalsWrapper);

        }

        return wrapper;
    },

    getScripts: function () {
        return [];
    },

    getStyles: function () {
        return [
            //"modules/MMM-citybus/css/MMM-citybus.css",
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

    parseEstimate: function (rawEstimate) {
        rawEstimate = rawEstimate.routeStopSchedules[0]

        this.nearestEstimate = this.formatTime(rawEstimate.stopTimes[0].estimatedDepartTimeUtc);
    },

    processData: function (data, type) {
        let self = this;
        if (this.loaded === false) { self.updateDom(self.config.animationSpeed); }
        this.loaded = true;

        if (type === "schedule") {
            self.parseSchedule(JSON.parse(data));
        }
        else if (type === "estimate") {
            self.parseEstimate(JSON.parse(data));
        }


        self.updateDom();

    },

    // socketNotificationReceived from helper
    socketNotificationReceived: function (notification, payload) {
        if (notification === "MMM-citybus-GOT-LOCAL-TIME") {
            // set dataNotification
            this.dataNotification = payload;
            this.updateDom();
        }
    },


});

