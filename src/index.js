import React from "react";
import ReactDOM from "react-dom"
import PropTypes from "prop-types";

import moment from "moment-timezone";
import { RRule, RRuleSet } from "rrule";

import "./index.css";

import Event from "./event";
import MultiEvent from './multiEvent';

import { css } from '@emotion/core';


export default class Calendar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      monthNames: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      today: moment(),
      current: moment().startOf("month"), //current position on calendar (first day of month)
      events: [],//all day or multi day events
      singleEvents: [], //single day events
      calendarTimezone: "",
      useCalendarTimezone: this.props.useCalendarTimezone,
      calendarId: this.props.calendarId,
      apiKey: this.props.apiKey,
      
      //calendar colors
      borderColor: this.props.borderColor,
      textColor: this.props.textColor,
      backgroundColor: this.props.backgroundColor,
      todayTextColor: this.props.todayTextColor,
      todayBackgroundColor: this.props.todayBackgroundColor,

      //event colors
      eventBorderColor: this.props.eventBorderColor,
      eventHoverColor: this.props.eventHoverColor,
      eventTextColor: this.props.eventTextColor,
      eventCircleColor: this.props.eventCircleColor,
    };
    this.lastMonth = this.lastMonth.bind(this);
    this.nextMonth = this.nextMonth.bind(this);
  }

  //init and load google calendar api
  componentDidMount() {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    document.body.appendChild(script);
    script.onload = () => {
      gapi.load("client", () => {
        gapi.client.init({ apiKey: this.props.apiKey })
          .then(() => {
            this.loadCalendarAPI();
          });
      });
    };
  }

  //add in events after rendering calendar
  componentDidUpdate() {
    this.clearEvents();
    this.renderEvents();
  }

  loadCalendarAPI() {
    gapi.client
      .load(
        "https://content.googleapis.com/discovery/v1/apis/calendar/v3/rest"
      )
      .then(
        () => {
          console.log("GAPI client loaded for API");
          this.getEventsList();
        },
        (err) => {
          console.error("Error loading GAPI client for API", err);
        }
      );
  }

  //stores events from google calendar into state
  getEventsList() {
    gapi.client.calendar.events.list({
      calendarId: this.props.calendarId,
      maxResults: 1000,
    })
      .then(
        (response) => {
          // Handle the results here (response.result has the parsed body).
          let singleEvents = [];
          let events = [];
          let changed = [];
          let cancelled = [];
          let calendarTimezone = "";

          response.result.items.forEach((event) => {
            
            if (event.originalStartTime) { //cancelled/changed events
              if ((!calendarTimezone) && event.originalStartTime.timeZone && this.state.useCalendarTimezone) {
                calendarTimezone = event.originalStartTime.timeZone;
              }
              if (event.status == "cancelled") {
                cancelled.push({
                  recurringEventId: event.recurringEventId,
                  originalStartTime: this.state.useCalendarTimezone ? moment.parseZone(event.originalStartTime.dateTime || event.originalStartTime.date) : moment(event.originalStartTime.dateTime || event.originalStartTime.date), 
                });
              } else if (event.status == "confirmed") {
                changed.push({
                  recurringEventId: event.recurringEventId,
                  name: event.summary,
                  description: event.description,
                  location: event.location,
                  originalStartTime: this.state.useCalendarTimezone ? moment.parseZone(event.originalStartTime.dateTime || event.originalStartTime.date) : moment(event.originalStartTime.dateTime || event.originalStartTime.date),
                  newStartTime: this.state.useCalendarTimezone ? moment.parseZone(event.start.dateTime || event.start.date) : moment(event.start.dateTime || event.start.date),
                  newEndTime: this.state.useCalendarTimezone ? moment.parseZone(event.end.dateTime || event.end.date) : moment(event.end.dateTime || event.end.date),
                });
              } else {
                console.log("Not categorized: ", event);
              }
            } else if (event.status == "confirmed") {
              if ((!calendarTimezone) && event.start.timeZone && this.state.useCalendarTimezone) {
                calendarTimezone = event.start.timeZone;
              }
              let newEvent = {
                id: event.id,
                name: event.summary,
                startTime: this.state.useCalendarTimezone ? moment.parseZone(event.start.dateTime || event.start.date) : moment(event.start.dateTime || event.start.date), //read date if datetime doesn"t exist
                endTime: this.state.useCalendarTimezone ? moment.parseZone(event.end.dateTime || event.end.date) : moment(event.end.dateTime || event.end.date),
                description: event.description,
                location: event.location,
                recurrence: event.recurrence,
                changedEvents: [],
                cancelledEvents: [],
              };

              //use same way of distinguishing as google calendar
              //duration is at least 24 hours or ends after 12pm on the next day
              if (moment.duration(newEvent.endTime.diff(newEvent.startTime)).asHours() >= 24 || (!newEvent.startTime.isSame(newEvent.endTime, 'day') && newEvent.endTime.hour() >= 12)) {
                events.push(newEvent);
              } else {
                singleEvents.push(newEvent);
              }
            } else {
              console.log("Not categorized: ", newEvent);
            }
          });

          events.forEach((event, idx, arr) => {
            if (event.recurrence) {
              //push changed events
              changed.filter(change => change.recurringEventId == event.id).forEach((change) => {
                arr[idx].changedEvents.push(change);
              });

              //push cancelled events
              cancelled.filter(cancel => cancel.recurringEventId == event.id).forEach((cancel) => {
                arr[idx].cancelledEvents.push(cancel.originalStartTime);
              });
            }
          });

          singleEvents.forEach((event, idx, arr) => {
            if (event.recurrence) {
              //push changed events
              changed.filter(change => change.recurringEventId == event.id).forEach((change) => {
                arr[idx].changedEvents.push(change);
              });

              //push cancelled events
              cancelled.filter(cancel => cancel.recurringEventId == event.id).forEach((cancel) => {
                arr[idx].cancelledEvents.push(cancel.originalStartTime);
              });
            }
          });
          if (this.state.useCalendarTimezone) {
            this.setState({calendarTimezone: calendarTimezone});
          } else {
            this.setState({calendarTimezone: moment.tz.guess()});
          }
          this.setState({ events: events, singleEvents: singleEvents });
        },
        (err) => {
          console.error("Execute error", err);
        }
      );
  }

  lastMonth() {
    this.setState({ current: this.state.current.subtract(1, "months") });
  }

  nextMonth() {
    this.setState({ current: this.state.current.add(1, "months") });
  }

  clearEvents() {
    for (let i = 1; i <= this.state.current.daysInMonth(); i++) {
      const myNode = document.getElementById("day-" + i);
      while (myNode.lastElementChild) {
        myNode.removeChild(myNode.lastElementChild);
      }
    }
  }
  
  renderDays() {
    return this.state.days.map((x, i) => (
      <div
        className="day-name"
        key={"day-of-week-" + i}
        css={{ borderColor: this.props.borderColor }}
      >
        {x}
      </div>
    ));
  }

  renderDates() {
    var days = [...Array(this.state.current.daysInMonth() + 1).keys()].slice(1); // create array from 1 to number of days in month

    var dayOfWeek = this.state.current.day(); //get day of week of first day in the month

    var padDays = (((-this.state.current.daysInMonth() - this.state.current.day()) % 7) + 7) % 7; //number of days to fill out the last row    


    return [
      [...Array(dayOfWeek)].map((x, i) => (
        <div
          className="day"
          key={"empty-day-" + i}
          css={{ borderColor: this.props.borderColor }}
        ></div>
      )),
      days.map(x => {
        if (x == this.state.today.date() && this.state.current.isSame(this.state.today, "month")) {
          return (
            <div
              className="day"
              key={"day-" + x}
              css={{ 
                borderColor: this.props.borderColor,
                color: this.state.todayTextColor,
                background: this.state.todayBackgroundColor,
              }}
            >
              <span
                css={{
                  paddingRight: '6px',
                }}
              >
                {x}
              </span>
              <div className="innerDay" id={"day-" + x}></div>
            </div>
          );
        } else {
          return (
            <div
              className="day"
              key={"day-" + x}
              css={{ borderColor: this.props.borderColor }}
            >
              <span
                css={{
                  paddingRight: '6px',
                }}
              >
                {x}
              </span>
              <div className="innerDay" id={"day-" + x}></div>
            </div>
          );
        }
      }),
      [...Array(padDays)].map((x, i) => (
        <div
          className="day"
          key={"empty-day-2-" + i}
          css={{ borderColor: this.props.borderColor }}
        ></div>
      ))
    ];
  }

  renderEvents() {
    let eventProps = {
      borderColor: this.state.eventBorderColor,
      hoverColor: this.state.eventHoverColor,
      textColor: this.state.eventTextColor,
      circleColor: this.state.eventCircleColor,
    }
    this.state.events.forEach((event) => {
      if (event.recurrence) {
        let duration = moment.duration(event.endTime.diff(event.startTime));
        
        //get recurrences using RRule
        let options = RRule.parseString(event.recurrence[0]);
        options.dtstart = new Date(Date.UTC(event.startTime.year(), event.startTime.month(), event.startTime.day(), event.startTime.hour(), event.startTime.minute()));
        console.log("START", options.dtstart.toUTCString());
        let rule = new RRule(options);
        let rruleSet = new RRuleSet();
        rruleSet.rrule(rule);
        
        let beginTime = moment(this.state.current).subtract(duration);
        let begin = new Date(Date.UTC(beginTime.year(), beginTime.month(), beginTime.date(), beginTime.hour(), beginTime.minute()));
        let endTime = moment(this.state.current).add(1, "month")
        let end = new Date(Date.UTC(endTime.year(), endTime.month(), endTime.date(), endTime.hour(), endTime.minute()));
        let dates = rruleSet.between(begin, end); //shitty workaround bc js timezone sucks
        console.log("BEGIN", begin, beginTime);
        console.log("END", end, endTime);
        console.log(dates);
        console.log(this.state.current);
        //render recurrences
        dates.forEach((date) => {
          //check if it is in cancelled
          if (event.cancelledEvents.some((cancelledMoment) => (cancelledMoment.isSame(date, "day")))) {
            return;
          }
          //if event has changed
          const changedEvent = event.changedEvents.find((changedEvent) => (changedEvent.originalStartTime.isSame(date, "day")));
          if (changedEvent) {
            var props = {
              name: changedEvent.name,
              startTime: changedEvent.newStartTime,
              endTime: changedEvent.newEndTime,
              description: changedEvent.description,
              location: changedEvent.location,
            }
          } else {
            let eventStart = moment.utc(date); //avoid bad timezone conversions
            let eventEnd = moment(eventStart).add(duration);
            var props = {
              name: event.name,
              startTime: eventStart,
              endTime: eventEnd,
              description: event.description,
              location: event.location,
            };
          }
          
          let tempNode = document.createElement("div");
          document.getElementById("day-" + moment(props.startTime).date()).appendChild(tempNode);
          ReactDOM.render(<MultiEvent {...props} {...eventProps}></MultiEvent>, tempNode);
        });
      } else {
        //render event
        if (event.startTime.month() != this.state.current.month() || event.startTime.year() != this.state.current.year()) {
          return;
        }
        let node = document.createElement("div");
        document.getElementById("day-" + moment(event.startTime).date()).appendChild(node);
        ReactDOM.render(<MultiEvent {...event} {...eventProps}></MultiEvent>, node);
      }
    });

    this.state.singleEvents.forEach((event) => {
      if (event.recurrence) {
        let duration = moment.duration(event.endTime.diff(event.startTime));
        
        //get recurrences using RRule
        let options = RRule.parseString(event.recurrence[0]);
        options.dtstart = new Date(Date.UTC(event.startTime.year(), event.startTime.month(), event.startTime.day(), event.startTime.hour(), event.startTime.minute()));
        let rule = new RRule(options);
        let rruleSet = new RRuleSet();
        rruleSet.rrule(rule);
        console.log(moment(this.state.current).subtract(duration).toDate(), moment(this.state.current).add(1, "month").toDate());
        let dates = rruleSet.between(moment(this.state.current).subtract(duration).toDate(), moment(this.state.current).add(1, "month").toDate()); //get occurences this month
        
        //render recurrences
        dates.forEach((date) => {
          //check if it is in cancelled
          if (event.cancelledEvents.some((cancelledMoment) => (cancelledMoment.isSame(date, "day")))) {
            return;
          }

          //if event has changed
          const changedEvent = event.changedEvents.find((changedEvent) => (changedEvent.originalStartTime.isSame(date, "day")));
          if (changedEvent) {
            var props = {
              name: changedEvent.name,
              startTime: changedEvent.newStartTime,
              endTime: changedEvent.newEndTime,
              description: changedEvent.description,
              location: changedEvent.location,
            }
          } else {
            let eventStart = moment.utc(date); //avoid bad timezone conversions
            let eventEnd = moment(eventStart).add(duration);
            var props = {
              name: event.name,
              startTime: eventStart,
              endTime: eventEnd,
              description: event.description,
              location: event.location,
            };
          }
          
          let tempNode = document.createElement("div");
          document.getElementById("day-" + moment(props.startTime).date()).appendChild(tempNode);
          ReactDOM.render(<Event {...props} {...eventProps}></Event>, tempNode);
        });
      } else {
        //render event
        if (event.startTime.month() != this.state.current.month() || event.startTime.year() != this.state.current.year()) {
          return;
        }
        let node = document.createElement("div");
        document.getElementById("day-" + moment(event.startTime).date()).appendChild(node);
        ReactDOM.render(<Event {...event} {...eventProps}></Event>, node);
      }
    });
  }

  render() {
    return (
      <div
        className="calendar"
        css={{
          borderColor: this.props.borderColor,
          color: this.props.textColor,
          background: this.props.backgroundColor,
        }}
      >
        <div className="calendar-header">
          <div
            className="calendar-navigate unselectable"
            onClick={this.lastMonth}
          >
            &#10094;
          </div>
          <div>
            <h2 className="calendar-title">
              {this.state.monthNames[this.state.current.month()]}{" "}
              {this.state.current.year()}
            </h2>
          </div>
          <div
            className="calendar-navigate unselectable"
            onClick={this.nextMonth}
          >
            &#10095;
          </div>
        </div>
        <div className="calendar-body">
          {this.renderDays()}
          {this.renderDates()}
        </div>
        <div className="calendar-footer">
          <div className="footer-text">
            All times shown in timezone: {this.state.calendarTimezone.replace("_", " ")}
          </div>
          <div className="footer-button">
            <a href={"https://calendar.google.com/calendar/r?cid=" + this.state.calendarId} target="_blank" id="add-to-calendar">
              <div className="logo-plus-button">
                <div className="logo-plus-button-plus-icon"></div>
                <div className="logo-plus-button-lockup">
                  <span className="logo-plus-button-lockup-text">Calendar</span>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    );
  }
}
  

Calendar.propTypes = {
  calendarId: PropTypes.string.isRequired,
  apiKey: PropTypes.string.isRequired,

  useCalendarTimezone: PropTypes.bool,
  
  //calendar colors
  borderColor: PropTypes.string,
  textColor: PropTypes.string,
  backgroundColor: PropTypes.string,
  todayTextColor: PropTypes.string,
  todayBackgroundColor: PropTypes.string,

  //event colors
  eventBorderColor: PropTypes.string,
  eventHoverColor: PropTypes.string,
  eventTextColor: PropTypes.string,
  eventCircleColor: PropTypes.string,
}

Calendar.defaultProps = {
  useCalendarTimezone: false,

  //calendar colors
  textColor: "#51565d",
  borderColor: "LightGray",
  
  //event colors
  eventBorderColor: "rgba(81, 86, 93, 0.1)",
  eventHoverColor: "rgba(81, 86, 93, 0.1)",
  eventTextColor: "#51565d",
  eventCircleColor: "#4786ff",
}