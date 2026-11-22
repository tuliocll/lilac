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
        "kj",
        "infrared_ac"
      ]
    },
    "controls": [
      {
        "code": [
          "switch",
          "power"
        ],
        "type": "power",
        "slot": "header"
      },
      {
        "code": [
          "temp_set",
          "temp"
        ],
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
          "fan_speed",
          "wind"
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
    ]
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
    ]
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
    ]
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
    "controls": []
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
    ]
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
    "controls": []
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
          "colour_data_v2",
          "colour_data"
        ],
        "type": "color",
        "slot": "main",
        "icon": "palette",
        "showWhen": {
          "work_mode": "colour"
        }
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
    ]
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
    ]
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
    ]
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
    ]
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
    },
    "colour_data_v2": {
      "pt-BR": "Cor",
      "en": "Colour"
    },
    "colour_data": {
      "pt-BR": "Cor",
      "en": "Colour"
    },
    "power": {
      "pt-BR": "Ligado",
      "en": "Power"
    },
    "temp": {
      "pt-BR": "Temperatura",
      "en": "Temperature"
    },
    "wind": {
      "pt-BR": "Ventilação",
      "en": "Fan speed"
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
