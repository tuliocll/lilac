// GERADO por scripts/build.mjs — não edite. Edite gadgets/<id>/gadget.json.
import type { CommonLabels, GadgetProfile } from './types.ts';

export const PROFILES: GadgetProfile[] = [
  {
    "id": "climate",
    "name": {
      "pt-BR": "Ar-condicionado",
      "en": "Air conditioner"
    },
    "tone": "sky",
    "layout": "climate",
    "match": {
      "categories": [
        "kt",
        "ktkzq",
        "qn",
        "cs",
        "jsq",
        "kj"
      ]
    },
    "controls": [
      {
        "code": "switch",
        "type": "power",
        "slot": "header"
      },
      {
        "code": "temp_set",
        "type": "setpoint",
        "slot": "hero",
        "unit": "°C"
      },
      {
        "code": [
          "temp_current"
        ],
        "type": "readout",
        "slot": "aside",
        "icon": "thermo",
        "unit": "°C"
      },
      {
        "code": "mode",
        "type": "select",
        "slot": "chips",
        "icon": "mode"
      },
      {
        "code": [
          "fan_speed_enum",
          "windspeed",
          "fan_speed"
        ],
        "type": "select",
        "slot": "chips",
        "icon": "fan"
      },
      {
        "code": "sleep",
        "type": "toggle",
        "slot": "chips",
        "icon": "sleep"
      },
      {
        "code": [
          "switch_vertical",
          "windshake",
          "swing"
        ],
        "type": "toggle",
        "slot": "chips",
        "icon": "swing"
      },
      {
        "code": "eco",
        "type": "toggle",
        "slot": "chips",
        "icon": "eco"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"4\" width=\"20\" height=\"9\" rx=\"2\"/><path d=\"M6 10h12\"/><path d=\"M7 16c0 1.5-1 2-1 3.5M12 16c0 1.5-1 2-1 3.5M17 16c0 1.5-1 2-1 3.5\"/></svg>"
  },
  {
    "id": "cover",
    "name": {
      "pt-BR": "Cortina / portão",
      "en": "Cover / gate"
    },
    "tone": "lilac",
    "layout": "cover",
    "match": {
      "categories": [
        "cl",
        "ckmkzq"
      ]
    },
    "controls": [
      {
        "code": [
          "control",
          "mach_operate"
        ],
        "type": "buttons",
        "slot": "hero"
      },
      {
        "code": "percent_control",
        "type": "slider",
        "slot": "main",
        "icon": "cover",
        "unit": "%"
      },
      {
        "code": "percent_state",
        "type": "readout",
        "slot": "readouts",
        "unit": "%"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3h18\"/><path d=\"M5 3v15c2 0 3-2 3-6V3M19 3v15c-2 0-3-2-3-6V3\"/><path d=\"M5 21h14\"/></svg>"
  },
  {
    "id": "fan",
    "name": {
      "pt-BR": "Ventilador",
      "en": "Fan"
    },
    "tone": "mint",
    "layout": "fan",
    "match": {
      "categories": [
        "fs",
        "fsd"
      ]
    },
    "controls": [
      {
        "code": [
          "switch",
          "fan_switch"
        ],
        "type": "power",
        "slot": "hero"
      },
      {
        "code": [
          "fan_speed_percent",
          "fan_speed"
        ],
        "type": "slider",
        "slot": "main",
        "icon": "fan",
        "display": "percent"
      },
      {
        "code": [
          "fan_speed_enum"
        ],
        "type": "select",
        "slot": "chips",
        "icon": "fan"
      },
      {
        "code": "mode",
        "type": "select",
        "slot": "chips",
        "icon": "mode"
      },
      {
        "code": [
          "switch_horizontal",
          "switch_vertical"
        ],
        "type": "toggle",
        "slot": "chips",
        "icon": "swing"
      },
      {
        "code": [
          "countdown_set",
          "countdown"
        ],
        "type": "select",
        "slot": "main",
        "icon": "timer"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 10c0-4 1-7 4-7 2 0 2.5 3-1 5.5M14 12c4 0 7 1 7 4 0 2-3 2.5-5.5-1M12 14c0 4-1 7-4 7-2 0-2.5-3 1-5.5M10 12c-4 0-7-1-7-4 0-2 3-2.5 5.5 1\"/></svg>"
  },
  {
    "id": "gateway",
    "name": {
      "pt-BR": "Gateway",
      "en": "Gateway"
    },
    "tone": "mint",
    "layout": "hub",
    "match": {
      "categories": [
        "wg2",
        "wfcon",
        "zigbeeszq"
      ]
    },
    "note": {
      "pt-BR": "Este é o hub dos seus dispositivos Zigbee/Bluetooth. Eles aparecem na lista como “via gateway”; o controle deles pelo hub vem numa próxima versão.",
      "en": "This hub bridges your Zigbee/Bluetooth devices. They show up as “via gateway”; controlling them through the hub is coming in a future version."
    },
    "controls": [],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"13\" width=\"18\" height=\"7\" rx=\"2\"/><path d=\"M7 16.5h.01M11 16.5h.01\"/><path d=\"M12 13V9\"/><path d=\"M8.5 7.5a5 5 0 0 1 7 0M6 5a8.5 8.5 0 0 1 12 0\"/></svg>"
  },
  {
    "id": "generic",
    "name": {
      "pt-BR": "Dispositivo",
      "en": "Device"
    },
    "tone": "neutral",
    "layout": "generic",
    "match": {
      "categories": []
    },
    "controls": [
      {
        "code": [
          "switch",
          "switch_1",
          "switch_led"
        ],
        "type": "power",
        "slot": "hero"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3\"/><path d=\"M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01\"/></svg>"
  },
  {
    "id": "ir",
    "name": {
      "pt-BR": "Controle infravermelho",
      "en": "IR blaster"
    },
    "tone": "lilac",
    "layout": "hub",
    "match": {
      "categories": [
        "wnykq"
      ]
    },
    "note": {
      "pt-BR": "Este controle comanda aparelhos por infravermelho (como os ares “via gateway”). Enviar comandos IR pela rede local ainda não é suportado.",
      "en": "This blaster drives appliances over infrared (like the “via gateway” air conditioners). Sending IR commands locally isn't supported yet."
    },
    "controls": [],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"14\" r=\"3\"/><path d=\"M8.5 10.5a5 5 0 0 1 7 0M6 8a8.5 8.5 0 0 1 12 0\"/><path d=\"M12 17v4\"/></svg>"
  },
  {
    "id": "light",
    "name": {
      "pt-BR": "Lâmpada",
      "en": "Light"
    },
    "tone": "sun",
    "layout": "light",
    "match": {
      "categories": [
        "dj",
        "dd",
        "xdd",
        "fwd",
        "dc"
      ]
    },
    "controls": [
      {
        "code": [
          "switch_led",
          "switch_1"
        ],
        "type": "power",
        "slot": "hero"
      },
      {
        "code": [
          "bright_value_v2",
          "bright_value"
        ],
        "type": "slider",
        "slot": "main",
        "icon": "sun",
        "display": "percent"
      },
      {
        "code": [
          "temp_value_v2",
          "temp_value"
        ],
        "type": "slider",
        "slot": "main",
        "icon": "thermo",
        "showWhen": {
          "work_mode": "white"
        },
        "display": "percent"
      },
      {
        "code": "work_mode",
        "type": "select",
        "slot": "chips",
        "icon": "mode"
      },
      {
        "code": [
          "countdown_1",
          "countdown"
        ],
        "type": "stepper",
        "slot": "main",
        "icon": "timer"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18h6M10 21h4\"/><path d=\"M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z\"/></svg>"
  },
  {
    "id": "plug",
    "name": {
      "pt-BR": "Tomada",
      "en": "Plug"
    },
    "tone": "pink",
    "layout": "plug",
    "match": {
      "categories": [
        "cz",
        "pc"
      ]
    },
    "controls": [
      {
        "code": [
          "switch_1",
          "switch"
        ],
        "type": "power",
        "slot": "hero"
      },
      {
        "code": "switch_2",
        "type": "toggle",
        "slot": "main",
        "icon": "power"
      },
      {
        "code": "switch_3",
        "type": "toggle",
        "slot": "main",
        "icon": "power"
      },
      {
        "code": "cur_power",
        "type": "readout",
        "slot": "readouts",
        "icon": "bolt"
      },
      {
        "code": "cur_voltage",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": "cur_current",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": "add_ele",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": [
          "countdown_1",
          "countdown"
        ],
        "type": "stepper",
        "slot": "main",
        "icon": "timer"
      },
      {
        "code": "relay_status",
        "type": "select",
        "slot": "main"
      },
      {
        "code": "child_lock",
        "type": "toggle",
        "slot": "main",
        "icon": "lock"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 2v5M15 2v5\"/><path d=\"M6 7h12v4a6 6 0 0 1-12 0z\"/><path d=\"M12 17v5\"/></svg>"
  },
  {
    "id": "sensor",
    "name": {
      "pt-BR": "Sensor",
      "en": "Sensor"
    },
    "tone": "mint",
    "layout": "sensor",
    "match": {
      "categories": [
        "wsdcg",
        "mcs",
        "mc",
        "pir",
        "hps",
        "ywbj",
        "rqbj",
        "sj"
      ]
    },
    "note": {
      "pt-BR": "Sensores a bateria dormem e quase nunca respondem pela rede local. Os valores podem estar desatualizados.",
      "en": "Battery sensors sleep and rarely answer on the local network. Values may be stale."
    },
    "controls": [
      {
        "code": [
          "va_temperature",
          "temp_current"
        ],
        "type": "readout",
        "slot": "hero",
        "icon": "thermo",
        "unit": "°C"
      },
      {
        "code": [
          "va_humidity",
          "humidity_value"
        ],
        "type": "readout",
        "slot": "readouts",
        "icon": "drop",
        "unit": "%"
      },
      {
        "code": "doorcontact_state",
        "type": "readout",
        "slot": "hero"
      },
      {
        "code": "pir",
        "type": "readout",
        "slot": "hero"
      },
      {
        "code": "battery_percentage",
        "type": "readout",
        "slot": "readouts",
        "unit": "%"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7\"/></svg>"
  },
  {
    "id": "switch",
    "name": {
      "pt-BR": "Interruptor",
      "en": "Switch"
    },
    "tone": "peach",
    "layout": "switch",
    "match": {
      "categories": [
        "kg",
        "tdq",
        "clkg"
      ]
    },
    "controls": [
      {
        "code": [
          "switch_1",
          "switch"
        ],
        "type": "power",
        "slot": "hero"
      },
      {
        "code": "switch_2",
        "type": "toggle",
        "slot": "main",
        "icon": "power"
      },
      {
        "code": "switch_3",
        "type": "toggle",
        "slot": "main",
        "icon": "power"
      },
      {
        "code": "switch_4",
        "type": "toggle",
        "slot": "main",
        "icon": "power"
      },
      {
        "code": "cur_power",
        "type": "readout",
        "slot": "readouts",
        "icon": "bolt"
      },
      {
        "code": "cur_voltage",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": "cur_current",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": "add_ele",
        "type": "readout",
        "slot": "readouts"
      },
      {
        "code": [
          "countdown_1",
          "countdown"
        ],
        "type": "stepper",
        "slot": "main",
        "icon": "timer"
      },
      {
        "code": "relay_status",
        "type": "select",
        "slot": "main"
      },
      {
        "code": "child_lock",
        "type": "toggle",
        "slot": "main",
        "icon": "lock"
      }
    ],
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"3\"/><rect x=\"9\" y=\"7\" width=\"6\" height=\"10\" rx=\"1.5\"/><path d=\"M12 9v2\"/></svg>"
  }
];

export const COMMON: CommonLabels = {
  "codes": {
    "switch": {
      "pt-BR": "Ligado",
      "en": "Power"
    },
    "switch_1": {
      "pt-BR": "Ligado",
      "en": "Power"
    },
    "switch_2": {
      "pt-BR": "Canal 2",
      "en": "Channel 2"
    },
    "switch_3": {
      "pt-BR": "Canal 3",
      "en": "Channel 3"
    },
    "switch_4": {
      "pt-BR": "Canal 4",
      "en": "Channel 4"
    },
    "switch_led": {
      "pt-BR": "Luz",
      "en": "Light"
    },
    "countdown_1": {
      "pt-BR": "Temporizador",
      "en": "Timer"
    },
    "countdown": {
      "pt-BR": "Temporizador",
      "en": "Timer"
    },
    "cur_power": {
      "pt-BR": "Potência",
      "en": "Power draw"
    },
    "cur_voltage": {
      "pt-BR": "Tensão",
      "en": "Voltage"
    },
    "cur_current": {
      "pt-BR": "Corrente",
      "en": "Current"
    },
    "add_ele": {
      "pt-BR": "Consumo",
      "en": "Energy"
    },
    "relay_status": {
      "pt-BR": "Ao religar a energia",
      "en": "After power loss"
    },
    "child_lock": {
      "pt-BR": "Trava infantil",
      "en": "Child lock"
    },
    "light_mode": {
      "pt-BR": "Indicador",
      "en": "Indicator light"
    },
    "battery_percentage": {
      "pt-BR": "Bateria",
      "en": "Battery"
    },
    "battery_state": {
      "pt-BR": "Bateria",
      "en": "Battery"
    },
    "temp_current": {
      "pt-BR": "Ambiente",
      "en": "Room"
    },
    "va_temperature": {
      "pt-BR": "Temperatura",
      "en": "Temperature"
    },
    "va_humidity": {
      "pt-BR": "Umidade",
      "en": "Humidity"
    },
    "humidity_value": {
      "pt-BR": "Umidade",
      "en": "Humidity"
    },
    "temp_set": {
      "pt-BR": "Temperatura",
      "en": "Temperature"
    },
    "mode": {
      "pt-BR": "Modo",
      "en": "Mode"
    },
    "work_mode": {
      "pt-BR": "Modo",
      "en": "Mode"
    },
    "bright_value": {
      "pt-BR": "Brilho",
      "en": "Brightness"
    },
    "bright_value_v2": {
      "pt-BR": "Brilho",
      "en": "Brightness"
    },
    "temp_value": {
      "pt-BR": "Tom de branco",
      "en": "White tone"
    },
    "temp_value_v2": {
      "pt-BR": "Tom de branco",
      "en": "White tone"
    },
    "fan_speed_enum": {
      "pt-BR": "Ventilação",
      "en": "Fan speed"
    },
    "windspeed": {
      "pt-BR": "Ventilação",
      "en": "Fan speed"
    },
    "fan_speed": {
      "pt-BR": "Ventilação",
      "en": "Fan speed"
    },
    "sleep": {
      "pt-BR": "Sono",
      "en": "Sleep"
    },
    "eco": {
      "pt-BR": "Eco",
      "en": "Eco"
    },
    "switch_vertical": {
      "pt-BR": "Oscilar",
      "en": "Swing"
    },
    "windshake": {
      "pt-BR": "Oscilar",
      "en": "Swing"
    },
    "doorcontact_state": {
      "pt-BR": "Porta",
      "en": "Door"
    },
    "pir": {
      "pt-BR": "Movimento",
      "en": "Motion"
    },
    "control": {
      "pt-BR": "Controle",
      "en": "Control"
    },
    "percent_control": {
      "pt-BR": "Abertura",
      "en": "Position"
    },
    "percent_state": {
      "pt-BR": "Posição",
      "en": "Position"
    },
    "temp_unit_convert": {
      "pt-BR": "Unidade",
      "en": "Unit"
    },
    "fault": {
      "pt-BR": "Falha",
      "en": "Fault"
    }
  },
  "options": {
    "cold": {
      "pt-BR": "Frio",
      "en": "Cool"
    },
    "hot": {
      "pt-BR": "Quente",
      "en": "Heat"
    },
    "heat": {
      "pt-BR": "Quente",
      "en": "Heat"
    },
    "auto": {
      "pt-BR": "Auto",
      "en": "Auto"
    },
    "wind": {
      "pt-BR": "Ventilar",
      "en": "Fan"
    },
    "fan": {
      "pt-BR": "Ventilar",
      "en": "Fan"
    },
    "wet": {
      "pt-BR": "Desumidificar",
      "en": "Dry"
    },
    "dehumidification": {
      "pt-BR": "Desumidificar",
      "en": "Dry"
    },
    "low": {
      "pt-BR": "Baixa",
      "en": "Low"
    },
    "middle": {
      "pt-BR": "Média",
      "en": "Medium"
    },
    "mid": {
      "pt-BR": "Média",
      "en": "Medium"
    },
    "high": {
      "pt-BR": "Alta",
      "en": "High"
    },
    "strong": {
      "pt-BR": "Turbo",
      "en": "Turbo"
    },
    "mute": {
      "pt-BR": "Silencioso",
      "en": "Quiet"
    },
    "on": {
      "pt-BR": "Ligar",
      "en": "On"
    },
    "off": {
      "pt-BR": "Desligar",
      "en": "Off"
    },
    "memory": {
      "pt-BR": "Lembrar",
      "en": "Remember"
    },
    "power_on": {
      "pt-BR": "Ligar",
      "en": "On"
    },
    "power_off": {
      "pt-BR": "Desligar",
      "en": "Off"
    },
    "last": {
      "pt-BR": "Lembrar",
      "en": "Remember"
    },
    "white": {
      "pt-BR": "Branco",
      "en": "White"
    },
    "colour": {
      "pt-BR": "Cor",
      "en": "Colour"
    },
    "scene": {
      "pt-BR": "Cena",
      "en": "Scene"
    },
    "music": {
      "pt-BR": "Música",
      "en": "Music"
    },
    "open": {
      "pt-BR": "Abrir",
      "en": "Open"
    },
    "close": {
      "pt-BR": "Fechar",
      "en": "Close"
    },
    "stop": {
      "pt-BR": "Parar",
      "en": "Stop"
    },
    "continue": {
      "pt-BR": "Continuar",
      "en": "Continue"
    },
    "none": {
      "pt-BR": "Nenhum",
      "en": "None"
    },
    "relay": {
      "pt-BR": "Seguir relé",
      "en": "Follow relay"
    },
    "pos": {
      "pt-BR": "Localizador",
      "en": "Locator"
    },
    "c": {
      "pt-BR": "°C",
      "en": "°C"
    },
    "f": {
      "pt-BR": "°F",
      "en": "°F"
    },
    "true": {
      "pt-BR": "Sim",
      "en": "Yes"
    },
    "false": {
      "pt-BR": "Não",
      "en": "No"
    }
  }
};
